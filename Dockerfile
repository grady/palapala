FROM node

WORKDIR /opt/palapala
COPY . .

RUN npm install .
RUN npm run build

EXPOSE 8000

CMD ["node", "src/server.js"]