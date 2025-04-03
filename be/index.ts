import express from 'express';
import cors from 'cors';
const PORT = 6969;

const app = express()

app.use(cors())

app.get('/api/validators', async (req: any, res: any) => {
	const walruscanNodeData = await fetch(
		`https://walruscan.com/api/walscan-backend/mainnet/api/validators?page=0&sortBy=STAKE&orderBy=DESC&searchStr=&size=150`
	);
	const data = await walruscanNodeData.json();
	console.log(data)
	res.json(data);
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));