FROM node:20-slim

# Install Tor and curl
RUN apt-get update && apt-get install -y tor curl procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 7860

RUN chmod +x start.sh
CMD ["./start.sh"]
