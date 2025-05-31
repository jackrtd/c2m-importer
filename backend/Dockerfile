# backend/Dockerfile
# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# Make uploads directory available (if not using a volume for it directly in compose)
RUN mkdir -p uploads

# Expose port 3000 (or whatever port your app runs on)
EXPOSE 3000

# Define the command to run your app
CMD [ "npm", "start" ]