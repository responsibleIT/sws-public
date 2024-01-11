const fastify = require("fastify")({ logger: true });
const path = require("path");
const sdk = require("node-appwrite");
const { Eta } = require("eta");
const crypto = require("crypto");
const { OpenAI } = require("openai");
require("dotenv").config();

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/public",
});

fastify.register(require("@fastify/view"), {
  engine: {
    eta: new Eta(),
  },
});

fastify.register(require("@fastify/cors"));

fastify.register(require("@fastify/formbody"));

fastify.register(require("fastify-socket.io"));

fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).view("/views/error.eta", {
    title: "Error | Six Word Story",
    authenticated: false,
  });
});

const openai = new OpenAI({
  apiKey: process.env.KEY,
});

const start = async () => {
  let client = new sdk.Client();
  client
    .setEndpoint(process.env.AW_ENDPOINT)
    .setProject(process.env.AW_PROJECT_ID)
    .setKey(process.env.AW_API_KEY);

  const database = new sdk.Databases(client);

  fastify.get("/", async (request, reply) => {
    const stories = (
      await database.listDocuments(
        process.env.AW_DATABASE_ID,
        process.env.AW_SWS_COLLECTION_ID
      )
    ).documents;
    return reply.view("/views/index.eta", { statement: stories[0].story });
  });

  fastify.get("/:id", async (request, reply) => {
    let id = request.params.id;
    try {
      let document = await database.getDocument(
        process.env.AW_DATABASE_ID,
        process.env.AW_SWS_COLLECTION_ID,
        id
      );
      return reply.view("/views/index.eta", { statement: document.story });
    } catch (error) {
      return reply.view("/views/error.eta", {
        title: "Error | Six Word Story",
        authenticated: false,
      });
    }
  });

  fastify.post("/alt", async (request, reply) => {
    console.log(request.body);
    let statement = request.body.statement.replace(/\s+/g, " ").trim();
    curr_subtext_id = crypto.randomUUID();

    let argument = request.body.rep.match(/[a-zA-Z]+/g);
    let pos = request.body.rep.match(/\d+/g);
    let argumentsentence = `${argument.join(" ")} at word position ${pos}`;

    console.log(argumentsentence);

    let msgs = [];
    msgs.push({
      role: "user",
      content: `"${statement} 
                    I want to replace ${argumentsentence} of this text.
                    Give me 6 alternative words that fits within this text.
                    In DUTCH!
                    The alternative word needs to be grammatically correct and fit logically within the whole story!
                    Also give me the index of the word that you replaced.
                    The replacement-word needs to fit in-place and we can just swap it straight up with the word on the index.
                    Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation. 
                    Like {alternatives: [{word: 'word', wordindex: 1}, {word: 'word', wordindex: 1}, {word: 'word', wordindex: 1}, {word: 'word', wordindex: 1}, {word: 'word', wordindex: 1}, {word: 'word', wordindex: 1}]}`,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: msgs,
    });

    let data = JSON.parse(completion.choices[0].message.content);
    console.log(data);
    return (
      data.alternatives
        .map((word, index) => {
          return `<div id="arg${index}" class="animate__animated animate__fadeInLeft">
                         <input type="radio" id="ment${index}" name="argument" value="${word.word}" hx-post="/placearg" hx-refresh="true" hx-target="body" hx-swap="innerHTML" hidden hx-indicator=".spinner">
                         <input hidden name="wordindex" value="${word.wordindex}">
                         <label for="ment${index}" class="argument second-argument-row animate_animated animate__fadeInDown">
                             ${word.word}
                        </label>
                    </div>`;
        })
        .join("") +
      `
                <script>
                    document.getElementById("arg0").onclick = () => {
                        document.getElementById("arg0").style.filter = "saturate(2)"
                    }
                    
                    document.getElementById("arg1").onclick = () => {
                        document.getElementById("arg1").style.filter = "saturate(2)"
                    }
                    
                    document.getElementById("arg2").onclick = () => {
                        document.getElementById("arg2").style.filter = "saturate(2)"
                    }
                    
                    document.getElementById("arg3").onclick = () => {
                        document.getElementById("arg3").style.filter = "saturate(2)"
                    }
                    
                    document.getElementById("arg4").onclick = () => {
                        document.getElementById("arg4").style.filter = "saturate(2)"
                    }
                    
                    document.getElementById("arg5").onclick = () => {
                        document.getElementById("arg5").style.filter = "saturate(2)"
                    }
                `
    );
  });

  fastify.post("/placearg", async (request, reply) => {
    console.log(request.body);

    let index = request.body.wordindex[0];
    let new_word = request.body.argument;
    let statement = request.body.statement;

    curr_option_id = crypto.randomUUID();

    let msg = {
      "role": "user",
      "content": `This is the statement: ${statement}.
                Replace the word in the starting at word position ${index} with this new word: ${new_word}.
                Keep the statement the same! It has to be as close to the original statement as possible. If it does not make grammatical sense, you have fix the text minimally!
                Keep the formatting exactly the same!
                Do not include any explanations.
                Don't use any quotes like " or ' in your response. `,
    };

    let data = await stream(msg);

    return reply.view("/views/index.eta", {
      title: "Swap",
      bk: process.env.BK,
      host: process.env.ENDPOINT,
      statement: data,
    });
  });

  const sleep = (waitTimeInMs) =>
    new Promise((resolve) => setTimeout(resolve, waitTimeInMs));

  async function stream(msg) {
    let completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [msg],
      stream: true,
    });
    let whole = "";
    let show_whole = "";
    for await (const part of completion) {
      let output = part.choices[0]?.delta?.content || "";
      if (output.includes(":")) {
        continue;
      }

      whole += output;
      if (output.includes("ARG=")) {
        show_whole += output.replaceAll(/ARG=/g, "");
      } else if (output.includes('"')) {
        show_whole += output.replaceAll(/['"]+/g, "");
      } else {
        show_whole += output;
      }

      //   show_whole += output;
      show_whole = show_whole.replaceAll(/ARG=/g, "");
      fastify.io.emit("part", show_whole);
    }

    fastify.io.emit("part", "DONE");

    await sleep(1000);

    return whole;
  }

  try {
    await fastify.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
