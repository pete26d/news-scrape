var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/newScrape";

// Connect to the Mongo DB

mongoose.connect(MONGODB_URI, { useNewUrlParser: true });


// Routes

// A GET route for scraping the website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.wunderground.com/").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

   
    $("div.story-body").each(function(i, element) {
      console.log(element);
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(element).find("h2").find(".hp-story-title").text();
      result.link = $(element).find("h2").find(".hp-story-title").attr("href");
      result.summary = $(element).find(".hp-story-summary").text();

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, log it
          console.log(err);
        });
    });

    // Send a message to the client
    res.redirect("/");
  });
});

app.get("/", function(req, res) {
  db.Article.find({})
    .then(function (dbArticle) {
      let hbsObject;
      hbsObject = {
          articles: dbArticle
      };
      res.render("index", hbsObject);
    })
    .catch(function (err) {
        // If an error occurred, send it to the client
        res.json(err);
    });
});

app.get("/saved", function (req, res) {
  db.Article.find({ saved: true })
      .then(function (retrievedArticles) {
          // If we were able to successfully find Articles, send them back to the client
          let hbsObject;
          hbsObject = {
              articles: retrievedArticles
          };
          res.render("saved", hbsObject);
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });
});

app.put("/remove/:id", function (req, res) {
  db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: false })
      .then(function (data) {
          // If we were able to successfully find Articles, send them back to the client
          res.json(data)
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
// Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.render(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with its note
app.get("/articles/:id", function (req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.find({ _id: req.params.id })
      // ..and populate all of the notes associated with it
      .populate({
          path: 'note',
          model: 'Note'
      })
      .then(function (dbArticle) {
          // If we were able to successfully find an Article with the given id, send it back to the client
          res.json(dbArticle);
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });
});

// Route for saving/updating an Article's associated Note
app.post("/note/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
      .then(function (dbNote) {
          // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
          return db.Article.findOneAndUpdate({ _id: req.params.id }, { $push: { note: dbNote._id } }, { new: true });
      })
      .then(function (dbArticle) {
          // If we were able to successfully update an Article, send it back to the client
          res.json(dbArticle);
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });
});

app.delete("/note/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.findByIdAndRemove({ _id: req.params.id })
      .then(function (dbNote) {

          return db.Article.findOneAndUpdate({ note: req.params.id }, { $pullAll: [{ note: req.params.id }] });
      })
      .then(function (dbArticle) {
          // If we were able to successfully update an Article, send it back to the client
          res.json(dbArticle);
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });
});



// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

app.put("/save/:id", function (req, res) {
  db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: true })
      .then(function (data) {
          // If we were able to successfully find Articles, send them back to the client
          res.json(data);
          console.log.apply("found");
      })
      .catch(function (err) {
          // If an error occurred, send it to the client
          res.json(err);
      });;
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
