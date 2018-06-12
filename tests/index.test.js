/* global page require */

const config = require('../jest-puppeteer.config');

const openPage = (url = '/') =>
      page.goto(`http://localhost:${config.server.port}${url}`);
