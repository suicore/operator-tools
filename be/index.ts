import express from 'express';
import cors from 'cors';

const app = express()
const PORT = 6969;

app.use(cors())

app.get('/api/validators', async (req: any, res: any) => {
	try {
		const nodeData = getNodeDataFromFile();
		return res.json(nodeData);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ error: 'Failed to fetch data' });
	}
});

function getNodeDataFromFile() {
	const fs = require('fs');
	const data = fs.readFileSync('./operators.json', 'utf8');
	return JSON.parse(data);
}

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));