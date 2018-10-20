/* 
===== Mongo notes
- mongoose makes the query to our MongoDB
- MDB uses an index for an individual collection (in this example, 1 for users and 1 for blogs)
-  the index is a data structure used to efficiently lookup records inside the collection
-  indexes are efficient because they allow us to not have to look at every record inside a collection to find what we are looking for
    -- if the _id are indexed (for example), it goes directly to the document for that collection - we don't have to scan the entire collection
- whenever an index is created, it targets an individual property of the document
    -- it can be setup to target multiple properties
** INDEXES ARE WHAT MAKE MDB SO FAST
- !!! if we ask to query for a property that's not indexed (like title), it has to scan the entire document aka a FULL COLLECTION SCAN....HUGE performance hit/very expensive
- Adding multiple indexes to a collection impacts the ability to write to the collection performantly i.e. for every index we add, it takes longer to write to the collection


===== Mongoose notes
- example custom query
*/
Person
  // make the query and add conditions('where')
  .find({ occupation: /host/ })
  .where("name.last")
  .equals("Ghost")
  .where("age")
  .gt(17)
  .lt(66)
  .where("likes")
  .in(["vaporizing", "talking"])
  //limit the number of responses
  .limit(10)
  .sort("-occupation")
  //select particular fields
  .select("name occupation")
  //  EXECUTE THE QUERY
  .exec(callback);
/*
**  Whenever we reference a collection and use find/where/limit/sort/etc, a `QUERY OBJECT` is created
    - each time we refine the search, a new object is created, so we can save it to a variable if we want
    -This represent a query that will be sent of to Mongo in the future:
*/
const query = Person.find({ occupation: /host/ })
  .where("name.last")
  .equals("Ghost")
  .where("age")
  .gt(17)
  .lt(66)
  .where("likes")
  .in(["vaporizing", "talking"])
  .limit(10)
  .sort("-occupation")
  .select("name occupation");
// check to see if this query is already in redis

query.getOptions(); // returns all of the options used when creating the query
//   WOULD MAKE A PERFECT KEY!  (just need to stringify)

// 3 way to trigger queries in Mongo
// 1
query.exec((err, result) => console.log(result));
// same as...
// 2 - .then calls exec behind the scenes
query.then(result => console.log(result));
// same as...
// 3 - async/await !!! this is how we are going to execute our queries
const result = await query;

// !!!!!!
//  We are going to override the built-in exec method
query.exec = function() {
  //check to see if the query has already been executed
  // and if it has, return the result right away
  const result = client.get("query key");
  if (result) return result;
  //otherwise execute the query *as normal*
  const result2 = runTheOriginalExecFunction();
  //then save the value in redis
  client.set("query key", result2);

  return result;
};

/*=====  Caching Layer
-  the Cache Layer/Server exists between mongoose and mongoDB
1-  anytime mongoose issues a query it first goes to the Cache Server
2-  The Cache Server checks to see if that exact query has every been run before
3a - If the query HAS NOT been run, it will forward the query on to MDB to be executed
  - the result of the query goes back to the cache server where it is stored and send it back to mongoose
3b - If the query HAS been requested by mongoose before, the cache server will take the stored results and send it back (it's not sent to Mongo)

!!! - the Caching server is doing a KEY/VALUE lookup
!!! - Cache is only used for READING Data, never writing
      - anytime we write to the db, we need to clear any associated data from the cache


=====  Redis
--  REDIS IS AN IN-MEMORY DATA STORE
--  A DB that lives in memory - once 'turned off' the contents are destroyed
--  VERY fast for reading and writing data
-node-redis->Redis->node-Redis
-set('hi','there')  ->  {'hi':'there'}  ->  get('hi', (err, val)=> console.log(val)) //'there'
- set(key, value)
- get(key, (err,val)=>{}) - async so we have a callback
Redis store values similar to JS objects
*/

// Setting an AUTOMATIC EXPIRATION
// > client.set('color', 'red')
// true
// > client.get('color', console.log)
// true
// > null 'red'

// // SETTING EXPIRATION - 4th param === # of seconds
// client.set('color', 'red', 'EX', 5)

/*
---getting started
- open up node REPL (Read-Eval-Print Loop):  >node (enter)
    -A Read–Eval–Print Loop (REPL), also known as an interactive toplevel or language shell, is a simple, interactive computer programming environment that takes single user inputs (i.e. single expressions), evaluates them, and returns the result to the user; a program written in a REPL environment is executed piecewise.
- require redis:  >const redis = require('redis')
- connect to the redis URL
      -'redis://127.0.0.1:6379' - default URL
  - >const redisUrl = 'redis://127.0.0.1:6379'
  - >const client = redis.createClient(redisUrl)
  - >client (enter -> show the redis object)

---setting up example data
  - >client.set('hi', 'there')
    > true (status message that lets us know things are working)
  -- can console.log the data two ways:
    - 1 - with a callback
    >client.get('hi', (err, val)=>console.log(val))
    > there
    - 2 - passing a reference to console.log
    >client.get('hi', console.log)
    > null 'there'  //null is the err value, 'there' is the val

---Redis Hashes
- redis isn't limited to basic key/value pairs like above, they can also do hashes - where the value for a key is a nested key value pair

- instead of using set, use `hset`
- hset(MASTER_KEY, VALUE_NESTED_KEY, VALUE_NESTED_VALUE)
  -  first two params are essentially lookups
  - hset('spanish', 'red', 'rojo')

- retrieving Hash values
- hget(MASTER_KEY, VALUE_NESTED_KEY, (err,val)=>console.log(val))
- hget('spanish', 'red', (err,val)=>console.log(val)) //rojo

*** whenever we store in redis, we can only store numbers and string...can't store objects
** NEED TO STRINGIFY OBJECTS

> client.set("colors", {red: 'rojo}) //warning - converted to [object Object]

> client.set("colors", JSON.stringify({red: 'rojo})) //true
> client.get('colors', console.log)
true
> null '{"red":"rojo"}'
//note this val is still in json format, need to json.parse
> client.get('colors', (err, val)=> console.log(JSON.parse(val))
> { red: 'rojo' }


// CLEAR THE CACHE!
> client.flushall();

*/
