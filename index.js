const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI);
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});
app.use(bodyParser.urlencoded({ extended: false }));
const exerciseSchema = new mongoose.Schema(
  {
    description: String,
    duration: Number,
    date: { type: Date, transform: (v) => v.toDateString() },
    username: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { versionKey: false }
);
const userSchema = new mongoose.Schema(
  {
    username: String,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
    versionKey: false,
  }
);
userSchema.virtual("log", {
  ref: "Exercise",
  localField: "_id",
  foreignField: "username",
});
userSchema.virtual("count", {
  ref: "Exercise",
  localField: "_id",
  foreignField: "username",
  count: true,
});
const Exercise = mongoose.model("Exercise", exerciseSchema);
const User = mongoose.model("User", userSchema);

app
  .route("/api/users")
  .get((req, res) => {
    User.find({}, "username")
      .then((users) => res.json(users))
      .catch((err) => console.log(err));
  })
  .post((req, res) => {
    const username = req.body.username;
    if (username) {
      const user = new User({
        username,
      });
      user
        .save()
        .then((user) => {
          console.log("User created: ", user);
          res.json(user);
        })
        .catch((err) => console.log(err));
    }
  });
app.post("/api/users/:_id/exercises", (req, res) => {
  const username = req.params._id;
  let { description, duration, date } = req.body;
  if (!date) date = new Date();
  const exercise = new Exercise({
    description,
    duration,
    username,
    date,
  });
  exercise
    .save()
    .then((exercise) => {
      console.log("User exercises updated: ", exercise);
      const userId = exercise.username;
      exercise
        .populate({ path: "username", transform: (v) => v.username })
        .then((exercise) => {
          exercise.toJSON();
          res.json({ ...exercise._doc, _id: userId });
        });
    })
    .catch((err) => console.log(err));
});

app.get("/api/users/:_id/logs", (req, res) => {
  let from = new Date(req.query.from);
  let to = new Date(req.query.to);
  const limit = req.query.limit;
  console.log({ from, to, limit });
  if (from == "Invalid Date") from = null;
  if (to == "Invalid Date") to = null;

  const match =
    from || to
      ? {
          date: {
            ...(from ? { $gte: from } : {}),
            ...(to ? { $lte: to } : {}),
          },
        }
      : {};

  User.findById(req.params._id, "username count log")
    .populate({ path: "count", match })
    .populate({
      path: "log",
      match,
      select: "description duration date -_id -username",
      options: {
        limit,
      },
    })
    .exec()
    .then((user) => {
      console.log({ user });
      res.json(user);
    })
    .catch((err) => console.log(err));
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
