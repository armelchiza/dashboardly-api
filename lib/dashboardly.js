const bcrypt = require('bcrypt-as-promised');
const knex = require('knex')({ client: 'mysql' });

const validate = require('./validations');
const util = require('./util');

const HASH_ROUNDS = 10;
const USER_FIELDS = ['id', 'email', 'createdAt', 'updatedAt'];
const BOARD_FIELDS = ['id', 'ownerId', 'title', 'description', 'createdAt', 'updatedAt'];
const BOARD_WRITE_FIELDS = ['ownerId', 'title', 'description'];


const BOOKMARK_FIELDS = ['id', 'boardId', 'title', 'url', 'createdAt', 'updatedAt']; // added
const BOOKMARK_WRITE_FIELDS = ['boardId', 'title', 'url'];


class DashboardlyDataLoader { // type of an object
  constructor(conn) {
    this.conn = conn;
  }


  query(sql) {
    return this.conn.query(sql);
  }

  // User methods
  createUser(userData) {
    const errors = validate.user(userData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }
    console.log('dashbo ... passed validation');
    return bcrypt.hash(userData.password, HASH_ROUNDS)
    .then((hashedPassword) => {
      return this.query(
        knex
        .insert({
          email: userData.email,
          password: hashedPassword
        })
        .into('users')
        .toString()
      );
    })
    .then((result) => {
      return this.query(
        knex
        .select(USER_FIELDS)
        .from('users')
        .where('id', result.insertId)
        .toString()
      );
    })
    .then(result => {
      return result[0]})
    .catch((error) => {
      // Special error handling for duplicate entry
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('A user with this email already exists');
      } else {
        throw error;
      }
    });
  }

  deleteUser(userId) {
    return this.query(
      knex.delete().from('users').where('id', userId).toString()
    );
  }

  getUserFromSession(sessionToken) {
    return this.query(
      knex
      .select(util.joinKeys('users', USER_FIELDS))
      .from('sessions')
      .join('users', 'sessions.userId', '=', 'users.id')
      .where({
        'sessions.token': sessionToken
      })
      .toString()
    )
    .then((result) => {
      if (result.length === 1) {
        return result[0];
      }
      return null;
    });
  }

  createTokenFromCredentials(email, password) {
    const errors = validate.credentials({
      email: email,
      password: password
    });
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    let sessionToken;
    let user;

    return this.query(
      knex
      .select('id', 'password')
      .from('users')
      .where('email', email)
      .toString()
    )
    .then((results) => {
      console.log('112 ' ,results);
      if (results.length === 1) {
        user = results[0];
        return bcrypt.compare(password, user.password).catch(() => false);
      }
      console.log('116 ' ,results);
      return false;
    })
    .then((result) => {
      if (result === true) {
        return util.getRandomToken();
      }

      throw new Error('Username or password invalid');
    })
    .then((token) => {
      sessionToken = token;
      return this.query(
        knex
        .insert({
          userId: user.id,
          token: sessionToken
        })
        .into('sessions')
        .toString()
      );
    })
    .then(() => sessionToken);
  }

  deleteToken(token) {
    return this.query(
      knex
      .delete()
      .from('sessions')
      .where('token', token)
      .toString()
    )
    .then(() => true);
  }


  // Board methods
  getAllBoards(options) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 20;
    const offset = (page - 1) * limit;

    return this.query(
      knex
      .select(BOARD_FIELDS)
      .from('boards')
      .limit(limit)
      .offset(offset)
      .toString()
    );
  }

  getSingleBoard(boardId) {
    return this.query(
      knex
      .select(BOARD_FIELDS)
      .from('boards')
      .where('id', boardId)
      .toString()
    );
  }

  createBoard(boardData) {
    const errors = validate.board(boardData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }
    console.log('182 :: ' , boardData);
    return this.query(
      knex
      .insert(util.filterKeys(BOARD_WRITE_FIELDS, boardData))
      .into('boards')
      .toString()
    )
    .then((result) => {
      return this.query(
        knex
        .select(BOARD_FIELDS)
        .from('boards')
        .where('id', result.insertId)
        .toString()
      );
    });
  }

  boardBelongsToUser(boardId, userId) {
    return this.query(
      knex
      .select('id')
      .from('boards')
      .where({
        id: boardId,
        ownerId: userId
      })
      .toString()
    )
    .then((results) => {
      if (results.length === 1) {
        return true;
      }

      throw new Error('Access denied');
    });
  }

  updateBoard(boardId, boardData) {
    const errors = validate.boardUpdate(boardData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    return this.query(
      knex('boards')
      .update(util.filterKeys(BOARD_WRITE_FIELDS, boardData))
      .where('id', boardId)
      .toString()
    )
    .then(() => {
      return this.query(
        knex
        .select(BOARD_FIELDS)
        .from('boards')
        .where('id', boardId)
        .toString()
      );
    });
  }

  deleteBoard(boardId) {
    return this.query(
      knex
      .delete()
      .from('boards')
      .where('id', boardId)
      .toString()
    );
  }

  // Bookmark methods
  getAllBookmarksForBoard(boardId) {
    // TODO: this is up to you to implement :)
    console.log('trying to get bookmarks d259');
    return this.query(
      knex
      .select(BOOKMARK_FIELDS)
      .from('bookmarks')
      .where('boardId', boardId)
      .toString()
    );

  }

  createBookmark(bookmarkData) {
    // TODO: this is up to you to implement :)

    // const errors = validate.board(boardData);
    // if (errors) {
    //   return Promise.reject({ errors: errors });
    // }
    console.log(bookmarkData);
    return this.query(
      knex
      .insert(util.filterKeys(BOOKMARK_WRITE_FIELDS, bookmarkData))
      .into('bookmarks')
      .toString()
    )
    .then((result) => {
      return this.query(
        knex
        .select(BOOKMARK_WRITE_FIELDS)
        .from('bookmarks')
        .where('id', result.insertId)
        .toString()
      );
    });
  }

  bookmarkBelongsToUser(bookmarkId, userId) {
    // TODO: this is up to you to implement :)

    return this.query(
      knex
      .select('boardId')
      .from('bookmarks')
      .where({
        id: bookmarkId
      })
      .toString()
    )

    .then((board) => {
      return (board[0].boardId);
    })
    .then((boardId) => {
      return this.query(
        knex
        .select('id')

        .from('boards')
        .where({
          id: boardId,
          ownerId: userId
        })
        .toString()
      )

    })
    .then((results) => {
      if (results.length === 1) {
        return true;
      }

      throw new Error('Access denied');
    });
  }

  updateBookmark(bookmarkId, bookmarkData) {
    // TODO: this is up to you to implement :)

    return this.query(
      knex('bookmarks')

      .update(util.filterKeys(BOOKMARK_WRITE_FIELDS, bookmarkData))
      .where('id', bookmarkId)
      .toString()
    )
    .then(() => {
      return this.query(
        knex
        .select(BOOKMARK_FIELDS)
        .from('bookmarks')
        .where('id', bookmarkId)
        .toString()
      );
    });

  }

  deleteBookmark(bookmarkId) {
    // TODO: this is up to you to implement :)
    return this.query(
      knex
      .delete()
      .from('bookmarks')
      .where('id', bookmarkId)
      .toString()
    );
  }
}

module.exports = DashboardlyDataLoader;
