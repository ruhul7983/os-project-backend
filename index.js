const express = require('express');
const bcrypt = require("bcrypt");

const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
//middle wire
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send("Hello")
});


// async function checkPassword(plainPassword,hashedPassword) {
//   const isMatch = await bcrypt.compare(plainPassword,hashedPassword);
//   return isMatch;
// }

async function hashPassword(plainPassword) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsqtl7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("diuTaskManagement").collection('users');
    const classroomCollection = client.db("diuTaskManagement").collection('classroom');
    const eventsCollection = client.db("diuTaskManagement").collection('events');

    app.post("/users", async (req, res) => {
      console.log(req.body);

      const { email, password, name, phone } = req.body;
      const exitingUser = await usersCollection.findOne({ email });
      if (exitingUser) {
        console.log(exitingUser);
        res.send({ status: 401, message: "User already exit" });
        return;
      }
      const hashedPassword = await hashPassword(password);
      const newUser = { email, password: hashedPassword, name, phone };
      const result = await usersCollection.insertOne(newUser);
      res.send({ status: true, message: "Registration Successful" });
      console.log("done");

    });
    app.post("/users/login", async (req, res) => {
      console.log(req.body);

      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) {
        res.send({ status: false, message: "User not Found" });
        return;
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        res.send({ status: 200, message: "Login Successful", user: user });
        console.log(isMatch);
        console.log(user);

      } else {
        res.send({ status: false, message: "Password not matched" });
      }
    });


    app.post("/classroom", async (req, res) => {
      const { email, semesterName, sectionName, classCode } = req.body;
      const classroom = { email, semesterName, sectionName, classCode, createdAt: new Date() };
      const existingClassroom = await classroomCollection.findOne({ $or: [{ sectionName }, { classCode }, { semesterName }] });
      console.log(existingClassroom);

      if (existingClassroom) {
        res.send({ status: 401, message: "Classroom already exit" });
        return;
      }
      const result = await classroomCollection.insertOne(classroom);
      res.send({ status: 200, message: "Classroom Created" });
    });

    app.post("/join-classroom", async (req, res) => {
      const { email, classCode } = req.body;

      const classroom = await classroomCollection.findOne({ classCode });
      if (!classroom) {
        res.send({ status: 401, message: "Classroom not found" });
        return;
      }
      const result = await classroomCollection.updateOne(
        { classCode },
        { $addToSet: { students: email } }
      );
      res.send({ status: 200, message: "Joined classroom successfully" });
    });

    app.get("/in-classroom", async (req, res) => {
      const { email } = req.query;
      // console.log("Email received in backend:", email);
      
      try {
        // Query to find classrooms where the students array contains the given email
        const classroom = await classroomCollection.findOne({
          $or: [
            { students: email }, // Check if `email` is in the `students` array
            { email: email },    // Check if the `email` field matches the `email`
          ],
        });

        console.log(classroom);
        if (!classroom) {
          // If no classrooms are found, send response indicating the student is not in any classroom
          res.send({ inClassroom: false });
          return;
        }
        const classCode = classroom.classCode;
        const events = await eventsCollection.find({ classCode }).toArray();
        // console.log(events);
        // If classrooms are found, send response indicating the student is in a classroom
        res.send({ inClassroom: true, sectionName: classroom?.sectionName,events });
      } catch (error) {
        console.error("Error fetching classrooms:", error);
        res.status(500).send({ error: "Internal Server Error test" });
      }
    });

    app.get("/cr", async (req, res) => {
      const { email } = req.query;
      const classroom = await classroomCollection.findOne({ email });
      if(!classroom){
        res.send({ isCr: false });
        return;}
      res.send({ isCr: true });
    });

    app.post("/add-event", async (req, res) => {
      const {eventName,date,courseName,topic,email} = req.body;
      const classroom = await classroomCollection.findOne({
        email: email     // Check if the `email` field matches the `email`
        
      });
      if (!classroom) {
        res.send({ status: 401, message: "Classroom not found" });
        return;
      } 
      const classCode = classroom.classCode;
      const event = { eventName, date, courseName, topic,classCode, createdAt: new Date() };
      console.log(event);
      
      const result = await eventsCollection.insertOne(event);
      
      if(result.insertedId){
        return res.send({ status: true, message: "Event Added" });
      }
      res.send({ status: false, message: "Event Added" });
    });




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})