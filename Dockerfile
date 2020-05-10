# Use an official Python runtime as a parent image
FROM node:6.13-slim

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY ./app.js /app/
COPY ./package*.json /app/
COPY ./normal.csv /app/
COPY ./game.conf /app/
COPY ./public/ /app/public/

# Install any needed packages specified
RUN npm install

# Make port 80 available to the world outside this container
EXPOSE 8080

# Define environment variable
#ENV NAME World

# Run app.py when the container launches
ENTRYPOINT ["node", "app.js"]
