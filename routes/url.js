var express = require('express');
var router = express.Router();
const { user, urlDB } = require('../config/dbconfig')
const { hashing, hashCompare, createJWT, authenticate, getUser, emailFromToken, sendResetMail, sendActivationMail, deleteUser, getUrl } = require('../utils/util')
const JWTD = require('jwt-decode')
const Crypto = require('crypto')


/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const hashedPassword = await hashing(password);
  const loginUser = await getUser(email)
  console.log(loginUser)
  try {
    if (loginUser?.email) {
      res.status(400).json({ message: 'User already exists' }) //400 for bad request
      return;
    } else {
      const activateString = Crypto.randomBytes(25).toString('hex');
      const activateJWT = await createJWT({ email, activateString }, 'activate')
      const data = await user.create({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: hashedPassword,
        accountActive: false,
        activateString: activateString,
      });

      const link = `${process.env.FRONTEND_URL}/activate/${activateJWT}/${activateString}` //change to frontend url
      // const link = `${process.env.API_URL}/activate/${activateJWT}/${activateString}` //change to frontend url

      let sentMail = sendActivationMail(email, link)
      if (sentMail) {
        res.status(201).json({ message: 'User created successfully and mail sent' }) // 200 for user creation
      }
      else {
        const newUser = await deleteUser(email)
        res.status(500).json({ message: 'Internal Server Error else' }) // 500 for internal server error
      }

    }
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Internal Server Error catch', error })
  }
})

router.get('/activate/:token/:activateString', authenticate, async (req, res) => {
  const { token, activateString } = req.params;
  try {
    const email = await emailFromToken(token);
    const dbUser = await getUser(email);
    // console.log(email, dbUser)
    if (dbUser.accountActive) {
      res.status(409).send({ message: 'Account already activated' });
      return;
    }    // res.send({ message: 'inside activate' });
    if (dbUser.activateString === activateString) {
      const updateUser = await user.findOneAndUpdate({ email: email }, { accountActive: true, activateString: '' }, { new: true });
      res.status(200).send({ message: 'Account activated', updateUser });
    } else {
      res.status(400).send({ message: 'Link not valid or link already used' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error catch', error: error.message })
  }

})

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password)
  // return;
  try {
    const dbUser = await getUser(email);
    if (dbUser) {
      const isAccountActive = dbUser.accountActive;
      console.log(isAccountActive)
      if (isAccountActive) {
        const isPasswordCorrect = await hashCompare(password, dbUser.password);
        if (isPasswordCorrect) {
          const token = await createJWT({ email, id: dbUser._id }, 'login');
          res.status(200).send({
            message: 'Login Successful', token, loggedUser: {
              firstName: dbUser.firstName,
              lastName: dbUser.lastName,
              email: dbUser.email,
            }
          });
        } else {
          res.status(401).send({ message: 'Password Incorrect' });
        }
      } else {
        res.status(409).send({ message: 'Account not activated' });
      }
    } else {
      res.status(400).send({ message: 'User not found' });
    }
  } catch (error) {

  }
})

router.post('/forgot-password', async (req, res) => {
  console.log('Forgot Password')
  const { email } = req.body;
  const userFromDB = await getUser(email);
  if (!userFromDB) {
    res.status(403).send({ message: 'User not found' });
  } else {
    try {
      const string = Crypto.randomBytes(25).toString('hex');
      const resetJWT = await createJWT({ email, string }, 'verify')
      const doc = await user.findOneAndUpdate({ email: email }, { verifyString: string }, { new: true })
      // const link = `${process.env.FRONTEND_URL}/reset-password/${string}` //change to frontend url
      const link = `${process.env.FRONTEND_URL}/forgot-password-redirect/${resetJWT}/${string}`;
      const sentMail = sendResetMail(email, link)
      if (sentMail) {
        res.status(200).send({ message: 'Mail sent' });
      } else {
        const doc = await user.findOneAndUpdate({ email: email }, { verifyString: '' }, { new: true })
        res.status(500).send({ message: 'Internal Server Error' });
      }
    } catch (error) {
      const doc = await user.findOneAndUpdate({ email: email }, { verifyString: '' }, { new: true })
      res.status(500).send({ message: 'Internal Server Error' });

    }

  }
})

router.post('/forgot-password/verify/:token/:string', authenticate, async (req, res) => {
  const { token, string } = req.params;
  const email = await emailFromToken(token);
  const userFromDB = await getUser(email);
  if (!userFromDB) {
    res.status(403).send({ message: 'User not found' });
  } else {
    try {
      if (userFromDB.verifyString === string) {
        res.status(200).send({ message: 'Verfied', token, email });
      } else {
        res.status(401).send({ message: 'Link not valid or link already used' });
      }
    } catch (error) {
      res.status(500).send({ message: 'Internal Server Error' });
    }
  }
})


router.post('/reset-password', async (req, res) => {
  const token = req.header('token');
  const { password } = req.body;
  const email = await emailFromToken(token);
  const userFromDB = await getUser(email);
  if (!userFromDB) {
    res.status(403).send({ message: 'User not found' });
  }
  else {
    try {
      const hashedPassword = await hashing(password);
      const doc = await user.findOneAndUpdate({ email: email }, { password: hashedPassword, verifyString: '' }, { new: true })
      res.status(200).send({ message: 'Password reset' });
    } catch (error) {
      console.log(error);
      res.status(500).send({ message: 'Internal Server Error', error });
    }
  }

})

router.post('/url/createurl', authenticate, async (req, res) => {
  const { url, customUrl, email } = req.body;
  console.log(" email ************************************** url " + email, url)
  // res.status(200).send({ message: 'url created' });
  try {
    const string = Crypto.randomBytes(10).toString('hex');
    const urlFromDB = await getUrl(email, url);
    // console.log("urlfound*******************************" + urlFound)
    console.log("DB user *****************************" + urlFromDB);
    const urlFound = urlFromDB.filter(link => link.email === email && link.url === url);
    console.log(urlFound);
    // return

    if (urlFound.length !== 0) {
      res.status(400).send({ message: 'Url already exists' });
    } else {
      const randomString = customUrl ? customUrl : string
      const shortLink = `${process.env.API_URL}/url/redirect/${randomString}`;
      console.log("random string ***********************************" + randomString)
      const date = new Date();
      const createdAt = new Date(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
      const id = Crypto.randomBytes(5).toString('hex')
      const doc = await urlDB.create({
        email: email,
        url: url,
        customUrl: randomString,
        shortUrl: shortLink,
        clicks: 0,
        createdAt: createdAt,
      })
      // console.log(doc)
      res.status(200).send({ message: 'url created', shortLink, randomString, date });
    }
  } catch (error) {
    console.error(error)
    res.status(500).send({ message: 'Internal Server Error', error });
  }
})

router.get('/url/getall', async (req, res) => {

  const email = req.header("email");
  console.log(email)

  try {
    const urls = await urlDB.find({ email });
    res.status(200).send({ message: 'urls fetched', urls });
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }

})

router.get('/url/:customUrl', async (req, res) => {
  const { customUrl } = req.params;
  console.log("custom url *************************" + customUrl)
  try {
    const url = await urlDB.findOne({ customUrl });
    console.log("url found *************************" + url)
    if (url) {
      const clicks = url.clicks + 1;
      const doc = await urlDB.findOneAndUpdate({ customUrl }, { clicks: clicks }, { new: true })
      console.log("doc *************************" + doc)
      res.redirect(url.url);
    } else {
      res.status(404).send({ message: 'Url not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
})

router.get('/urlinfo', authenticate, async (req, res) => {
  const email = req.header("email");
  const data = await urlDB.find({ email: email });
  const total = data.length
  const todayCount = data.filter(url => url.createdAt.getDate() === new Date().getDate() && url.createdAt.getMonth() === new Date().getMonth() && url.createdAt.getFullYear() === new Date().getFullYear())?.length
  const monthCount = data.filter(url => url.createdAt.getMonth() === new Date().getMonth() && url.createdAt.getFullYear() === new Date().getFullYear()).length
  res.status(200).send({ todayCount, monthCount,total });
})

module.exports = router;
