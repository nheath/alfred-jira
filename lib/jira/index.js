const sh = require('../alfred-exec');
const config = require('./config');
const cache = require('./cache');
const auth = require('./auth');
const ls = require('./list');
const Status = require('./transitions');
const users = require('./users');
const Assign = require('./assign');
const Comment = require('./comment');
const watch = require('./watch');
const worklog = require('./worklog');
const log = require('../alfred-log');
const create = require('./create');
const issueTypes = require('./issuetypes');
const Search = require('./search');

function getOptions() {
  if (this.checkConfig()) {
    return config.options;
  }
  else {
    log('Unable to get options. auth.checkConfig did not pass.');
    return [];
  }
}

function getBookmarks() {
  if (this.checkConfig()) {
    if (config.bookmarks && typeof config.bookmarks == 'object') {
      return config.bookmarks;
    }
  }
  return [];
}

function getAllBookmarks() {
  let self = this;
  return Promise.all(self.getBookmarks()
    .map((bookmark, index) =>
      self.listAll(`bookmark-${index}`)));
}

function getUsers() {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(users.getUsers.bind(users))
      .then(resolve)
      .catch(reject);
  });
}

function getIssueTypes(project) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        if (project) {
          return issueTypes.getIssueTypesByProject(project);
        }
        return issueTypes.getIssueTypes();
      })
      .then(resolve)
      .catch(reject);
  });
}

function testBookmark(bookmarkConfig) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => ls.showAll(bookmarkConfig))
      .then(resolve)
      .catch(res => {
        reject(res.response.data.errorMessages);
      });
  });
}

function listAll(bookmarkConfig) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        return ls.showAll(bookmarkConfig);
      })
      .then(resolve)
      .catch(res => {
        let err = res.response;
        log(err);
        if (!err) {
          reject('Unable to receive response from: ' +
            config.url + ' ' + '\n' + res);
        }
        if (err.status === 401) {
          auth.logout();
        }
        if (err.status === 403) {
          log('Too many failed login attempts: \n%s',
            err.headers['x-authentication-denied-reason']);
        }
        reject(err.status + ': ' + err.statusText);
      });
  });
}

function search(query) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => resolve(Search.search(query)))
      .catch(reject);
  });
}

function status(ticketId) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        return resolve(Status.availableTransitions(ticketId));
      })
      .catch(reject);
  });
}

function transition(ticketId, action, token) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        return resolve(Status.transition(ticketId, action, token));
      })
      .catch(reject);
  });
}

function createIssue() {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        return resolve(create());
      })
      .catch(reject);
  });
}

function assign(ticket, assignee) {
  let self = this;
  return new Promise((resolve, reject) => {
    if (!ticket) {
      return reject('No ticket specified');
    }
    self.auth()
      .then(() => {
        if (assignee) {
          Assign.to(ticket, assignee)
            .then(resolve)
            .catch(reject);
        }
        else {
          return reject('No assignee specified');
        }
      });
  });
}

function comment(ticket, comment) {
  let self = this;
  return new Promise((resolve, reject) => {
    if (!ticket || !comment) {
      return reject('Requires a ticket & comment.');
    }
    self.auth()
      .then(() => resolve(Comment(ticket, comment)))
      .catch(reject);
  });
}

function toggleWatch(ticket, currentState) {
  let self = this;
  return new Promise((resolve, reject) => {
    if (!ticket || currentState === undefined) {
      return reject('Requires a ticket & the current watched status');
    }
    self.auth()
      .then(() =>
        resolve(watch[['start', 'stop'][+currentState]](ticket)))
      .catch(reject);
  });
}

function startProgress(issue) {
  return worklog.start(issue);
}

function stopProgress(issue) {
  let self = this;
  return new Promise((resolve,reject) => {
    self.auth()
      .then(() => {
        worklog.stop(issue).then(resolve).catch(reject);
      });
  });
}

function clearProgress(issue) {
  return worklog.clearProgress(issue);
}

function getProgress(issue) {
  return worklog.getProgress(issue);
}

function listInProgress() {
  return worklog.inProgress();
}

function inProgressInfo(issue) {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(() => {
        worklog.inProgressInfo(issue).then(resolve).catch(reject);
      });
  });
}

function clearSettings() {
  return auth.clearConfig();
}

function clearCache() {
  let args = [...arguments];
  return cache.clear(args);
}

function refreshCache() {
  let self = this;
  self.clearCache.apply(self, arguments)
    .then(self.fetchData);
}

function editSettings() {
  this.auth()
    .then(() => {
      sh.spawn('npm', ['run', 'electron'],
        { detached: true, stdio: 'ignore' }).unref();
    });
}

function getStatuses() {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(auth.getStatuses.bind(auth))
      .then(resolve)
      .catch(reject);
  });
}

function getProjects() {
  let self = this;
  return new Promise((resolve, reject) => {
    self.auth()
      .then(auth.getProjects.bind(auth))
      .then(resolve)
      .catch(reject);
  });
}

function fetchData() {
  sh.spawn('node', ['./lib/background.js'],
    { detached: true, stdio: 'ignore'}).unref();
}

module.exports = Jira = {
  'login': () => auth.setConfig().then(auth.login.bind(auth)),
  'auth': () => auth.setConfig(),
  'checkConfig': () => auth.checkConfig(),
  getOptions,
  getBookmarks,
  getAllBookmarks,
  getUsers,
  getIssueTypes,
  getBookmarks,
  listAll,
  search,
  status,
  transition,
  createIssue,
  assign,
  comment,
  toggleWatch,
  startProgress,
  stopProgress,
  clearProgress,
  getProgress,
  listInProgress,
  inProgressInfo,
  clearSettings,
  clearCache,
  refreshCache,
  editSettings,
  getStatuses,
  getProjects,
  fetchData
};
