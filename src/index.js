require('dotenv').config()
const app = require("./server");
require("./moralis");
require('./init.mongodb');

app.get("/test", (_, res) => {
  res.send("Hello world!!");
});

app.use("/", require("./routes"));

app.use((req, res, next) => {
  const error = new Error("Not Found API");
  error.status = 404;
  next(error);
})
app.use((error, req, res, next) => {
  const statusCode = error.status || 500;
  return res.status(statusCode).json({
    status: "error",
    code: statusCode,
    stack: error.stack,
    message: error.message || "Internal Server Error"
  });
})

const server = app.listen(process.env.PORT, () => {
  console.log(`Server start on port ${process.env.PORT}`);
});

process.on("SIGINT", () => {
  server.close(async () => {
    console.log("Exit Server Express");
    process.exit(1);
  });
});