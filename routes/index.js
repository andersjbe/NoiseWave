const { User, Song, Like, Comment } = require("../db/models");
const { loggedInUser, requireAuth, generateUserToken } = require("../auth");
const {
  asyncHandler,
  modelNotFound,
  getS3Url,
  attachPicAndAudiotoSong,
  attachPicsToUser,
} = require("../utils");

// const fetch = require("node-fetch");
// const https = require("https");
// const httpsAgent = new https.Agent({
//   rejectUnauthorized: false,
// });
const axios = require("axios");
const { apiPort } = require("../config/index");

const express = require("express");
const csrf = require("csurf");
const bcrypt = require("bcryptjs");
const pug = require("pug");
const path = require("path");

const router = express.Router();

const csrfProtection = csrf({ cookie: true });
const userNotFound = modelNotFound("User");

// router.get("/", loggedInUser, (req, res) => {
//   if (req.user) res.redirect("/explore");
//   res.render("home");
// });

router.get("/", loggedInUser, (req, res) => {
  res.render("templates/ajaxLayout.pug", { user: req.user });
});

// router.get("/explore", loggedInUser, (req, res) => {
//   // TODO: get all relevant songs from the API and send them to the view
//   console.log(req.user);
//   res.render("explore", { user: req.user });
// });

router.get(
  "/explore",
  loggedInUser,
  asyncHandler((req, res) => {
    const ajaxExplore = pug.compileFile(
      path.join(express().get("views"), "explore.pug")
    );
    res.send(ajaxExplore({ user: req.user }));
  })
);

router.get(
  "/upload",
  loggedInUser,
  asyncHandler((req, res) => {
    const upload = pug.compileFile(
      path.join(express().get("views"), "upload.pug")
    );
    res.send(upload({ user: req.user }));
  })
);

router.get(
  "/search/:query",
  loggedInUser,
  asyncHandler(async (req, res) => {
    //made event handler that leads to this route. whatever was search is in params
    const { query } = req.params;
    console.log(query);
    //BOTH OF THESE API CALLS MUST BE UPDATED IF WE ARE USING PRODUCTION ENV
    const resUsers = await axios.get(
      `http://localhost:${apiPort}/search/users/${query}`
    );

    const matchingUsers = resUsers.data;

    const resSongs = await axios.get(
      `http://localhost:${apiPort}/search/songs/${query}`
    );

    const matchingSongs = resSongs.data;
    // console.log(matchingUsersArr);

    // console.log(matchingUsersArr);
    //AJAX SEARCH NOT WORKING, BUT PUG NO LONGER CRASHING
    // res.render("search-results", {
    //   user: req.user,
    //   songs,
    //   users,
    // });

    const matchingSongsFull = [];

    for (song of matchingSongs) {
      const fullInfo = await Song.findOne({
        include: [{ model: User }],
        where: {
          id: song.id,
        },
      });
      matchingSongsFull.push(fullInfo);
    }

    for (song of matchingSongsFull) {
      attachPicAndAudiotoSong(song);
    }

    for (user of matchingUsers) {
      attachPicsToUser(user);
    }

    console.log(matchingSongs);
    const searchResults = pug.compileFile(
      path.join(express().get("views"), "search-results.pug")
    );
    res.send(
      searchResults({
        user: req.user,
        matchingSongsFull,
        matchingUsers,
      })
    );
  })
);

router.get(
  "/:username",
  loggedInUser,
  asyncHandler(async (req, res, next) => {
    const { username } = req.params;

    if (
      username === "login" ||
      username === "search" ||
      username === "explore" ||
      username === "audio-test" ||
      username === "imagetest"
    ) {
      next();
      return;
    }
    const userData = await User.findOne({
      include: [{ model: Song }, { model: Like }],
      where: { username: username },
    });

    if (!userData) {
      next(userNotFound());
    }

    const likedSongs = userData.Likes.map(async (like) => {
      return await Song.findOne({
        include: [{ model: User }],
        where: { id: like.songId },
      });
    });

    // res.render("user-page", { userData, user: req.user });

    const userPage = pug.compileFile(
      path.join(express().get("views"), "user-page.pug")
    );
    res.send(userPage({ user: req.user, userData, likedSongs }));
  })
);

//song !== edit
router.get(
  "/:username/:song",
  loggedInUser,
  asyncHandler(async (req, res) => {
    if (req.params.username === "search" || req.params.song === "edit") {
      next();
      return;
    }
    const { song } = req.params.song;

    const songData = await Song.findOne({
      include: [{ model: User }, { model: Comment }, { model: Like }],
      where: { songLocalPath: req.params.song },
    });
    // res.render("song-page", { songData, currentUser: req.user });
    const songPage = pug.compileFile(
      path.join(express().get("views"), "song-page.pug")
    );
    res.send(songPage({ user: req.user, songData }));
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res, next) => {
    const { username, password } = req.body;
    const user = await User.findOne({
      where: {
        username,
      },
    });

    let validPassword = false;
    if (user) {
      validPassword = bcrypt.compareSync(
        password,
        user.hashedPassword.toString()
      );
    }

    if (!user || !validPassword) {
      res.ok = false;
      res.status(401);
      res.json({ message: "The provided credentials were invalid." });
    } else {
      const token = generateUserToken(user);

      res.json(token);
    }
  })
);

router.get(
  "/audio-test",
  asyncHandler(async (req, res) => {
    const audioFile = await getS3Url("songs/09 - Akira (1990)/01 - Kaneda.mp3");
    const imgFile = await getS3Url("raiseDeadMagic.jpg");

    res.render("audiofile", { audioFile, imgFile });
  })
);

module.exports = router;
