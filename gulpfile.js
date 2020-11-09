const dotenv = require('dotenv');
const fetch = require('cross-fetch');
const fs = require('fs');

const CONFIG_TEXT = `window._env_ = `;
const CONFIG_FILE_NAME = 'env-config.js';

const buildConfiguration = cb => {
  dotenv.config();
  const env = process.env;
  let configuration = {};
  const nodeEnv = env.NODE_ENV ? env.NODE_ENV : 'development';

  console.info(`Building for : '${nodeEnv}'`);

  Object.keys(env).forEach(function (key) {
    if (key.startsWith('REACT_APP')) {
      configuration[key] = env[key];
      console.info(`${key}: ${env[key]}`);
    }
  });

  configuration['REACT_APP_GRAPHQL_ENDPOINT'] =
    configuration['REACT_APP_GRAPHQL_ENDPOINT'] ||
    (nodeEnv === 'production' ? '/graphql' : 'http://localhost:4000/graphql');

  fs.writeFile(`./public/${CONFIG_FILE_NAME}`, `${CONFIG_TEXT}${JSON.stringify(configuration, null, 2)}`, cb);
};

possibleTypes = cb => {
  dotenv.config();
  const endpoint = process.env['REACT_APP_GRAPHQL_ENDPOINT'];
  console.log('Extracting from: ', endpoint);
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      variables: {},
      query: `
      {
        __schema {
          types {
            kind
            name
            possibleTypes {
              name
            }
          }
        }
      }
    `,
    }),
  })
    .then(result => result.json())
    .then(result => {
      const possibleTypes = {};

      result.data.__schema.types.forEach(supertype => {
        if (supertype.possibleTypes) {
          possibleTypes[supertype.name] = supertype.possibleTypes.map(subtype => subtype.name);
        }
      });

      fs.writeFile('./src/generated/possibleTypes.json', JSON.stringify(possibleTypes), err => {
        if (err) {
          console.error('Error writing possibleTypes.json', err);
        } else {
          console.log('Fragment types successfully extracted!');
        }
        cb();
      });
    });
};
exports.possibleTypes = possibleTypes;
exports.buildConfiguration = buildConfiguration;
exports.default = buildConfiguration;
