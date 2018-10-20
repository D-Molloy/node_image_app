const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
client.get = util.promisify(client.get);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.exec = async function() {
  console.log(`I'm about to run a query.`);
  // this is a reference to the current query we're trying to execute
  // console.log(this.getQuery());
  // console.log(this.mongooseCollection.name);

  // Creating the unique key
  // Object.assign is used to safely copy properties from one obj to another
  //1st param - the object that we're going to assign the properties to
  //2nd param - assign the properties from the obj returned from getQuery to the new object e.g.{ _user: '5bc816428927450f54be8ac4' }
  //3rd param - copy the collection property to the new obj
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );
  // console.log(key); // {"_id":"5bc816428927450f54be8ac4","collection":"users"}

  //  See if we have a value for `key` in redis
  const cacheValue = await client.get(key);

  //  If we do, return that
  if (cacheValue) {
    console.log(this);
    //the exec method expects a mongoose document/model that has methods attached to it
    //  this.model comes from the query being executed and turns the param into a mongoose model
    // in redis, the values are stored as an array of blog posts, not an object
    const doc = JSON.parse(cacheValue);

    //parsing or hydrating the values
    // if it's an array, map over each index and return a new model
    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  // Otherwise, issue the query and store the result in redis

  // the untouched version of exec that we haven't messed around with
  // apply will automatically pass in any arguments passed into exec also
  // this returns a Document Instance, not an object, which is what we want!
  const result = await exec.apply(this, arguments);
  //saving the result to REDIS
  //redis needs a string value (not an obj)
  client.set(key, JSON.stringify(result));

  return result;
};
