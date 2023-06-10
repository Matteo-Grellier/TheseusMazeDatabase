const Koa = require('koa');
const Router = require('koa-router');
const Logger = require('koa-logger');
const { Pool } = require('pg');
const { koaBody } = require('koa-body');
require('dotenv').config();

const app = new Koa();
const router = new Router();


app.pool = new Pool({
	user: process.env.DATABASEUSER,
	host: 'localhost',
	database: process.env.DATABASENAME,
	password: process.env.PASSWORD,
	port: 5432,
});

router.get('/getAllMazes', async (ctx) => {
	console.log(process.env.USER);
	console.log(process.env.DATABASENAME);
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
		console.log("Success !");
		ctx.body = { mazes };
	} catch (e) {
		console.error(e);
		ctx.status = 500;
	}
	finally {
		client.release();
	}
});

router.get('/getSingleMaze/:mazeid', async (ctx) => {
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
	catch (err) {
		console.log(err);
		ctx.body = "Error !";
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
		if (res.rowCount == 0) {
			ctx.response.status = 404;
			ctx.body = "Maze not found";
		} else {
			ctx.response.status = 200;
			ctx.body = "Success !";
		}
	}
	catch (e) {
		ctx.response.status = 500;
		ctx.body = e.message;
	}
	finally {
		client.release();
	}
})

router.put('/updateMaze/:mazeid', koaBody(), async (ctx) => {
	const client = await app.pool.connect();
	try {
		var mazes = ctx.body = ctx.request.body.mazes;
		await Promise.all(mazes.map(async (maze) => {
			const res = await client.query('UPDATE public.maze SET "mazeName"=$1 WHERE mazeid=$2;', [maze.mazeName, maze.mazeid]);
			console.log(res.rows);
			await Promise.all(maze.rooms.map(async (room) => {
				const res = await client.query('UPDATE public.room SET "leftDoor"=$1, "upDoor"=$2, "rightDoor"=$3, "downDoor"=$4, "isEndRoom"=$5 WHERE roomid=$6;', [room.leftDoor, room.upDoor, room.rightDoor, room.downDoor, room.isEndRoom, room.roomid]);
				await Promise.all(room.cases.map(async (cell) => {
					await client.query('UPDATE cell SET state=$1 WHERE cellid=$2', [cell.state, cell.cellid]);
				}));
			}));
		}));
		console.log("Sucess !");
		ctx.body = "Sucess !";
	}
	catch (err) {
		console.log(err);
		ctx.body = "Error !";
		ctx.status = 500;
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
