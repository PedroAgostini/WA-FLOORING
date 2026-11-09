<?php
/**
 * WA Flooring Specialist | Clean cache
 * Open https://waflooring.escolats.com.br/clean-cache to wipe this browser's
 * cached copy of the site (CSS, JS, images, local data) after a deploy.
 * It only affects the browser that opens it. Needs HTTPS.
 */
header('Clear-Site-Data: "cache", "storage"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: text/html; charset=utf-8');
$stamp = date('YmdHis');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="2;url=/?fresh=<?= $stamp ?>">
  <title>Cache cleared | WA Flooring Specialist</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #0B2739; color: #fff; text-align: center; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { color: #C9D3DA; }
    a { color: #D9A877; }
  </style>
</head>
<body>
  <div>
    <h1>Cache cleared.</h1>
    <p>Loading the latest version of the site&hellip;</p>
    <p><a href="/?fresh=<?= $stamp ?>">Go now</a></p>
  </div>
</body>
</html>
