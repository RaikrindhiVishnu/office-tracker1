const http = require("http");

const data = JSON.stringify({
  toEmail: "test@example.com",
  toName: "Test User",
  title: "Test",
  message: "Test msg",
  type: "info"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/notifications/send-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer testtoken'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", body);
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
