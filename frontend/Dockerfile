FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
