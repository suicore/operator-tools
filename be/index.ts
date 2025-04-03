import express from 'express';
import cors from 'cors';
import redis from 'redis';

const app = express()
const PORT = 6969;

const redisClient = redis.createClient({
	url: 'redis://default:default@redis:6379',
});

redisClient.connect()
	.then(() => console.log('Connected to Redis'))
	.catch((err) => console.error('Redis connection error:', err));

app.use(cors())

app.get('/api/validators', async (req: any, res: any) => {
	// Check redis cache first
	const cachedData = await redisClient.get('walruscanNodeData');
	if (cachedData) {
		return res.json(JSON.parse(cachedData));
	}

	console.log('Fetching data from walruscan...');
	const walruscanNodeData = await fetch(
		`https://walruscan.com/api/walscan-backend/mainnet/api/validators?page=0&sortBy=STAKE&orderBy=DESC&searchStr=&size=150`
	);

	if (!walruscanNodeData.ok) {
		console.log(walruscanNodeData.statusText);
		return res.status(500).json({ error: 'Failed to fetch data from walruscan' });
	}

	const data = await walruscanNodeData.json();
	await redisClient.set('walruscanNodeData', JSON.stringify(data))
	res.json(data);
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));