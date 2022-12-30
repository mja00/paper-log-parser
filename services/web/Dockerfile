# pull official base image
FROM python:3.11-slim-buster

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# install system depenedencies
RUN apt update && apt install -y netcat dos2unix

# install dependencies
RUN pip install --upgrade pip
COPY ./requirements.txt /usr/src/app/requirements.txt
RUN pip install -r requirements.txt

# copy project
COPY . /usr/src/app/

# Make sure /usr/src/app/entrypoint.sh is executable and dos2unix
RUN chmod +x /usr/src/app/entrypoint.sh
RUN dos2unix /usr/src/app/entrypoint.sh

# run entrypoint.sh
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]