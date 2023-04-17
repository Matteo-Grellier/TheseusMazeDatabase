const Koa = require('koa');
const Router = require('koa-router');
const Logger = require('koa-logger');
const { Pool } = require('pg');

const app = new Koa();
const router = new Router();

app.pool = new Pool({
    user: 'matteo',
    host: 'localhost',
    database: 'theseusdatabase',
    password: 'matteo', // Password is empty be default
    port: 5432, // Default port
});

router.get('/apiGetAll', async (ctx) => {
    const client = await app.pool.connect();
    try {
        const res = await client.query('SELECT * FROM maze');
        const mazes = res.rows;
        const mazesWithRooms = await Promise.all(mazes.map(async (maze) => {
            const res = await client.query('SELECT * FROM room WHERE mazeid = $1', [maze.mazeid]);
            const rooms = res.rows;
            const roomsWithCases = await Promise.all(rooms.map(async (room) => {
                const res = await client.query('SELECT * FROM cell WHERE roomid = $1', [room.roomid]);
                const cases = res.rows;
                return { ...room, cases };
            }));
            return { ...maze, rooms: roomsWithCases };
        }));
        console.log("Sucess !");
        ctx.body = mazesWithRooms;
    }
    finally {
        client.release();
    }
});

router.get('/apiGetMaze/:mazeid', async (ctx) => {
    const client = await app.pool.connect();
    try {
        const res = await client.query('SELECT * FROM maze WHERE mazeid = $1', [ctx.params.mazeid]);
        const maze = res.rows[0];
        const res2 = await client.query('SELECT * FROM room WHERE mazeid = $1', [maze.mazeid]);
        const rooms = res2.rows;
        const roomsWithCases = await Promise.all(rooms.map(async (room) => {
            const res = await client.query('SELECT * FROM cell WHERE roomid = $1', [room.roomid]);
            const cases = res.rows;
            return { ...room, cases };
        }));
        console.log("Sucess !");
        ctx.body = { ...maze, rooms: roomsWithCases };
    }
    finally {
        client.release();
    }
});

router.put('/apiPutMaze/:mazeid', async (ctx) => {
    const client = await app.pool.connect();
    try {
        const maze = ctx.request.body;
        await client.query('UPDATE maze SET mazeid = $1, mazeName = $2 WHERE mazeid = $3', [maze.mazeid, maze.mazeName, ctx.params.mazeid]);
        await Promise.all(maze.rooms.map(async (room) => {
            await client.query('UPDATE room SET x = $1, y = $2, width = $3, height = $4 WHERE roomid = $5', [room.x, room.y, room.width, room.height, room.roomid]);
            await Promise.all(room.cases.map(async (cell) => {
                await client.query('UPDATE cell SET x = $1, y = $2, type = $3 WHERE cellid = $4', [cell.x, cell.y, cell.type, cell.cellid]);
            }));
        }));
        console.log("Sucess !");
        ctx.body = "Sucess !";
    }
    finally {
        client.release();
    }
});

router.post('/apiPostAll', async (ctx) => {
    const client = await app.pool.connect();
    try {
        const mazes = ctx.request.body;
        await Promise.all(mazes.map(async (maze) => {
            const res = await client.query('INSERT INTO public.maze (mazeid) VALUES($1);', [maze.mazeid]);
            const mazeid = res.rows[0].mazeid;
            await Promise.all(maze.rooms.map(async (room) => {
                const res = await client.query('INSERT INTO public.room (roomid, mazeid, "leftDoor", "upDoor", "rightDoor", "downDoor", "isEndRoom") VALUES($1,$2,$3,$4);', [room.roomid, room.mazeid, room.leftDoor, room.upDoor, room.rightDoor, room.rightDoor, room.downDoor, room.isEndRoom]);
                const roomid = res.rows[0].roomid;
                await Promise.all(room.cases.map(async (cell) => {
                    await client.query('INSERT INTO cell (cellid, roomid, state) VALUES ($1, $2, $3)', [cell.roomid, cell.roomid, cell.state]);
                }));
            }));
        }));
        console.log("Sucess !");
        ctx.body = "Sucess !";
    }
    finally {
        client.release();
    }
});

// Development logging
app.use(Logger());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3005, () => {
    console.log('Server running on port 3005');
});
