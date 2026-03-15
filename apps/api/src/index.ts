import "dotenv/config";
import env from "./configs/env";

import http from "http";
import app from "./app";

const server = http.createServer(app);

function main() {
    console.log(env);
}
main();


server.listen(3000);
