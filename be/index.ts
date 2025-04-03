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

	const nodeData = await fetchNodeData();
	// Add 5 retries if the fetch fails
	if (!nodeData) {
		console.log('Fetching data from walruscan failed, trying again...');
		for (let i = 0; i < 10; i++) {
			const retryData = await fetchNodeData();
			if (retryData) {
				await redisClient.set('walruscanNodeData', JSON.stringify(retryData), {
					EX: 12 * 3600, // cache for 12 hours (12 * 3600 seconds)
				});
				return res.json(retryData);
			}
			console.log(`Retry ${i + 1} failed...`);
		}
		return res.status(500).json({ error: 'Failed to fetch data from walruscan' });
	}
});

async function fetchNodeData() {
	const response = await fetch(
		`https://walruscan.com/api/walscan-backend/mainnet/api/validators?page=0&sortBy=STAKE&orderBy=DESC&searchStr=&size=150`
	);

	if (!response.ok) {
		return false
	}

	return await response.json();
}

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));