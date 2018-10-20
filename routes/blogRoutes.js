const mongoose = require("mongoose");
const requireLogin = require("../middlewares/requireLogin");

const Blog = mongoose.model("Blog");

module.exports = app => {
  app.get("/api/blogs/:id", requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id
    });

    res.send(blog);
  });

  app.get("/api/blogs", requireLogin, async (req, res) => {
    const redis = require("redis");
    const redisUrl = "redis://127.0.0.1:6379";
    const client = redis.createClient(redisUrl);
    const util = require("util");
    //  client.get is async, to avoid using callbacks, we use the util module and promisify, takes any function that accepts a callback as the last argument and instead returns a promise
    //we overwrite the existing function
    client.get = util.promisify(client.get);

    //do we have any cached data in redis related to this query
    const cachedBlogs = await client.get(req.user.id);
    //if yes, respond to the request right away and return
    if (cachedBlogs) {
      console.log("Serving from Cache");
      return res.send(JSON.parse(cachedBlogs));
    }
    //if no, respond to request and update the data

    const blogs = await Blog.find({ _user: req.user.id });
    console.log("Serving from MongoDB");
    res.send(blogs);

    //need to update our cache with the blog data
    // key - req.user.id
    // value - blogs we found
    client.set(req.user.id, JSON.stringify(blogs));
  });

  app.post("/api/blogs", requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
