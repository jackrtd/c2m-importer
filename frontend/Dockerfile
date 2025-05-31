# frontend/Dockerfile
# Use an official Nginx image to serve static content
FROM nginx:alpine

# Remove default Nginx configuration
#RUN rm /etc/nginx/conf.d/default.conf

# Copy static assets from the frontend directory to Nginx's webroot
# This will overwrite the default Nginx welcome page with your index.html
COPY . /usr/share/nginx/html

# Expose port 80 (Nginx default)
EXPOSE 80

# Nginx will be started by default when the container runs