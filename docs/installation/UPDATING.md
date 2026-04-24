# Update to the latest version

To update to the latest version, follow these steps:

## For Docker users (pre-built images)

Pull the latest image and restart your container:

```bash
docker pull digi4care/perplexica-search-engine-ai:latest
docker stop perplexica
docker rm perplexica
docker run -d -p 3000:3000 -v perplexica-data:/home/digi4care/data --name perplexica digi4care/perplexica-search-engine-ai:latest
```

For slim version (bring your own SearxNG):

```bash
docker pull digi4care/perplexica-search-engine-ai:slim-latest
docker stop perplexica
docker rm perplexica
docker run -d -p 3000:3000 -e SEARXNG_API_URL=http://your-searxng-url:8080 -v perplexica-data:/home/digi4care/data --name perplexica digi4care/perplexica-search-engine-ai:slim-latest
```

Once updated, go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

## For Docker users (building from source)

1. Pull the latest changes:

   ```bash
   git pull origin master
   ```

2. Rebuild the Docker image:

   ```bash
   docker build -t perplexica .
   ```

3. Stop and remove the old container, then start the new one:

   ```bash
   docker stop perplexica
   docker rm perplexica
   docker run -p 3000:3000 -p 8080:8080 --name perplexica perplexica
   ```

4. Go to http://localhost:3000 and verify the latest changes.

## For non-Docker users

1. Pull the latest changes:

   ```bash
   git pull origin master
   ```

2. Install any new dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

3. Rebuild the application:

   ```bash
   npm run build
   ```

4. Restart the application:

   ```bash
   npm run start
   ```

5. Go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

---
