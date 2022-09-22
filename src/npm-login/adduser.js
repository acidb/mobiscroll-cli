var axios = require('axios');

function addUser (registryUrl, auth, proxy, cb) {
  const username = auth.username.trim();
  const password = auth.password.trim();
  const email = auth.email.trim();
  const data = {
    auth,
    _id: 'org.couchdb.user:' + username,
    name: username,
    password: password,
    email: email,
    type: 'user',
    roles: [],
    date: new Date().toISOString()
  };
  const requestOptions = {};

  if (proxy && Object.keys(proxy).length) {
    requestOptions.proxy = proxy;
  }

  registryUrl = new URL('-/user/org.couchdb.user:' + encodeURIComponent(username), registryUrl);

  axios.put(registryUrl.toString(), data, requestOptions).then(response => {
      cb(null, response.data)
  }).catch(error => {
    let err = error;
    if (error.response) {
      err = {
        status: error.response.status,
        message: (error.response.data.error || error.response.data) + ' ' + error.request.res.statusMessage
      }
    }
    cb(err);
  })
}

module.exports = addUser;