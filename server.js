const express = require("express");
const path = require("path");
const bodyparser = require("body-parser");
const cookieParser = require("cookie-parser");
const jsonwt = require("jsonwebtoken");
const passport = require("passport");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = express();

const port = process.env.port || 3000;

var staticData = require("./staticInfo/pageinfo");

var db = require("./values/urls").mongoURL;

var strings = require("./values/strings");

mongoose
  .connect(db)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.log(err));

app.use(cookieParser());

app.use(passport.initialize());

// use bodyparser

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

app.use(express.static(path.join(__dirname, "public")));

// import BlogPost schema

const BlogPost = require("./models/BlogPost");

// import User schema

const User = require("./models/User");

// set the view engine to ejs
app.set("view engine", "ejs");

// route / for home

app.get("/", (req, res) => {
  BlogPost.find({})
    .sort([["time", "descending"]])
    .exec((err, posts) => {
      staticData.blogpost = posts;
      res.render("index", staticData);
    });
});

app.get("/singlepost/:postid", (req, res) => {
  BlogPost.findById(req.params.postid, (err, ress) => {
    res.render("blog-single", ress);
  });
});

// route for login /admin/login
app.get("/admin/login", (req, res) => {
  res.render("login");
});

// route for edit post /admin/editpost post method

app.post("/admin/editpost/:postid", (req, res) => {
  let token = req.cookies.authentication;
  jsonwt.verify(token, strings.jwtsecret, function(err, user) {
    if (user) {
      id = req.params.postid;
      var tags = req.body.updatetags.split(",");
      var fullname = user.firstname + " " + user.lastname;
      var blogPost = new BlogPost({
        _id:id,
        title: req.body.updateposttitle,
        content: req.body.updatepostcontent,
        tags: tags,
        ByUserId: user.id,
        ByUserName: fullname,
        time: Date.now()
      });
      BlogPost.findByIdAndUpdate(id, blogPost, function(
        err,
        updatedBlogPost
      ) {
        console.log(err);
        if (!err) {
          res.send({ success: "Post updated successfully" });
        } else {
          res.send({ error: "Post Didn't update Please Try Again." });
        }
      });
    } else {
      res.redirect("/admin/login");
    }
  });
});

// route for delete post /admin/delete post method

app.get("/admin/deletepost/:postid", (req, res) => {
  let token = req.cookies.authentication;
  jsonwt.verify(token, strings.jwtsecret, function(err, user) {
    if (user) {
      BlogPost.findByIdAndRemove(req.params.postid, (err, ress) => {
        if (err) {
          res.send({ error: "Opration Failed Try Again." });
        } else {
          res.send({ success: "Post Deleted Successfully." });
        }
      });
    } else {
      res.redirect("/admin/login");
    }
  });
});

// route for add post /admin/addpost post method

app.post("/admin/addpost", (req, res) => {
  let token = req.cookies.authentication;
  jsonwt.verify(token, strings.jwtsecret, function(err, user) {
    if (user) {
      var tags = req.body.tags.split(",");
      var fullname = user.firstname + " " + user.lastname;
      var blogPost = new BlogPost({
        title: req.body.posttitle,
        content: req.body.postcontent,
        tags: tags,
        ByUserId: user.id,
        ByUserName: fullname,
        time: Date.now()
      });

      blogPost
        .save()
        .then(uploadedPost => {
          res.send({ success: "Post uploaded successfully" });
        })
        .catch(err => {
          res.send({ error: "Post Didn't Upload Please Try Again." });
        });
    } else {
      res.redirect("/admin/login");
    }
  });
});

// route for /admin home

app.get("/admin", (req, res) => {
  let token = req.cookies.authentication;
  jsonwt.verify(token, strings.jwtsecret, function(err, user) {
    if (user) {
      BlogPost.find({})
        .sort([["time", "descending"]])
        .exec((err, posts) => {
          res.render("home", { posts: posts });
        });
    } else {
      res.redirect("/admin/login");
    }
  });
});

// route for login  /admin/login post method

app.post("/admin/login", (req, res) => {
  User.findOne({
    $or: [{ email: req.body.username }, { username: req.body.username }]
  })
    .then(user => {
      if (user) {
        bcrypt.compare(req.body.password, user.password).then(isMatch => {
          if (isMatch) {
            const payload = {
              id: user._id,
              email: user.email,
              firstname: user.firstname,
              lastname: user.lastname,
              username: user.username
            };
            jsonwt.sign(
              payload,
              strings.jwtsecret,
              {
                expiresIn: 3600
              },
              (err, token) => {
                res.header("Access-Control-Allow-Origin", req.headers.origin);
                res.header(
                  "Access-Control-Allow-Headers",
                  "Origin, X-Requested-With, Content-Type, Accept"
                );
                res.cookie("authentication", token);
                res.redirect("/admin");
              }
            );
          } else {
            res.render("login", { error: "Password incorrect ." });
          }
        });
      } else {
        res.render("login", { error: "Email or Username dose not exist ." });
      }
    })
    .catch(err => {
      console.log(err);
    });
});

// route for register /admin/register

app.get("/admin/register", (req, res) => {
  res.render("register");
});

// route for register /admin/register post method

app.post("/admin/register", (req, res) => {
  User.findOne({
    $or: [{ email: req.body.email }, { username: req.body.username }]
  }).then(user => {
    if (user) {
      if (user.email === req.body.email) {
        return res.render("register", { error: "Email already registered." });
      } else if (user.username === req.body.username) {
        return res.render("register", {
          error: "Username already taken try another ."
        });
      }
    } else if (req.body.password !== req.body.repassword) {
      return res.render("register", { error: "Password mismatch ." });
    } else {
      const newUser = new User({
        email: req.body.email,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username: req.body.username,
        password: req.body.password
      });
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(uploadedUser => {
              res.render("register", {
                success: "Registered Successfully please login ."
              });
            })
            .catch(err => console.log(err));
        });
      });
    }
  });
});

// server listen
app.listen(port, () => {
  console.log("server running at port : " + port);
});
