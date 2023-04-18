const Koa = require('koa');
const Router = require('koa-router');
const Logger = require('koa-logger');
const { Pool } = require('pg');
const { koaBody } = require('koa-body');

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
        const mazesRows = res.rows;
        const mazes = await Promise.all(mazesRows.map(async (maze) => {
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
        ctx.body = { mazes };
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

router.post('/createMaze', koaBody(), async (ctx) => {
    const client = await app.pool.connect();
    try {
        var mazes = ctx.body = ctx.request.body.mazes;
        await Promise.all(mazes.map(async (maze) => {
            const res = await client.query('INSERT INTO public.maze ("mazeName") VALUES($1) RETURNING mazeid;', [maze.mazeName]);
            const mazeid = res.rows[0].mazeid;
            console.log(res.rows);
            await Promise.all(maze.rooms.map(async (room) => {
                const res = await client.query('INSERT INTO public.room ("mazeid" ,"leftDoor", "upDoor", "rightDoor", "downDoor", "isEndRoom") VALUES($1,$2,$3,$4,$5,$6) RETURNING roomid;', [mazeid, room.leftDoor, room.upDoor, room.rightDoor, room.downDoor, room.isEndRoom]);
                const roomid = res.rows[0].roomid;
                await Promise.all(room.cases.map(async (cell) => {
                    await client.query('INSERT INTO cell (roomid, state) VALUES ($1, $2)', [roomid, cell.state]);
                }));
            }));
        }));
        console.log("Sucess !");
        ctx.body = "Sucess !";
    }
    finally {
        client.release();
    }
})

router.delete('/deleteMaze/:mazeid', koaBody(), async (ctx) => {
    const client = await app.pool.connect();
    try {
        var mazes = ctx.body = ctx.request.body.mazes;
        const res = await client.query('DELETE FROM public.maze WHERE mazeid=$1;', [ctx.params.mazeid]);
        console.log("Sucess !");
        ctx.body = "Sucess !";
    }
    finally {
        client.release();
    }
})



// Development logging
app.use(Logger());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3001, () => {
    console.log('Server running on port 3001');
});
