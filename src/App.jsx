import "regenerator-runtime/runtime";
import "@babel/polyfill";
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Text,
  VStack,
  Input,
  HStack,
  Spinner,
  useDisclosure,
  useToast,
  Checkbox,
  Link,
  Textarea,
  Progress,
  Select,
  FormControl,
  FormLabel,
  Switch,
  Heading,
  OrderedList,
  ListItem,
  Icon,
  IconButton,
} from "@chakra-ui/react";
import MonacoEditor from "@monaco-editor/react";
import ReactBash from "react-bash";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";

import { useChatCompletion } from "./hooks/useChatCompletion";
import { SunsetCanvas } from "./elements/SunsetCanvas";
import EducationalModal from "./components/LearnModal/EducationalModal";
import SettingsMenu from "./components/SettingsMenu/SettingsMenu";
import { useSharedNostr } from "./hooks/useNOSTR";
import {
  createUser,
  getUserData,
  getUserStep,
  incrementUserStep,
  updateUserData,
} from "./utility/nosql";
import { steps } from "./utility/content";
import { PrivateRoute } from "./PrivateRoute";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { database } from "./database/firebaseResources";
import { translation } from "./utility/translation";
import { useCashuWallet } from "./hooks/useCashuWallet";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { isUnsupportedBrowser } from "./utility/browser";
import { PlusSquareIcon } from "@chakra-ui/icons";
import { IoShareOutline } from "react-icons/io5";
import { IoIosMore } from "react-icons/io";
import MultipleChoiceQuestion from "./components/MultipleChoice/MultipleChoice";
import SelectOrderQuestion from "./components/SelectOrder/SelectOrder";

import Confetti from "react-confetti";

const phraseToSymbolMap = {
  equals: "=",
  equal: "=",
  plus: "+",
  minus: "-",
  asterisk: "*",
  slash: "/",
  "open parenthesis": "(",
  "close parenthesis": ")",
  "open bracket": "[",
  "close bracket": "]",
  "open brace": "{",
  "close brace": "}",
  semicolon: ";",
};

const applySymbolMappings = (text) => {
  let modifiedText = text;
  Object.keys(phraseToSymbolMap).forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    modifiedText = modifiedText.replace(regex, phraseToSymbolMap[phrase]);
  });
  return modifiedText;
};

const AwardScreen = () => {
  const navigate = useNavigate();

  const handleRestart = () => {
    navigate("/q/0"); // Navigate to the first step to restart the quiz
  };

  return (
    <Box textAlign="center" p={5}>
      <Text fontSize="2xl" fontWeight="bold">
        Congratulations!
      </Text>
      <Text>You have completed the quiz. Well done!</Text>
      <Button mt={4} colorScheme="purple" onMouseDown={handleRestart}>
        Restart Quiz
      </Button>
    </Box>
  );
};

const VoiceInput = ({
  value,
  onChange,
  isCodeEditor,
  isTextInput = false,
  resetVoiceState,
  useVoice = false,
  isTerminal = false,
  stopListening,
  setFeedback,
  resetFeedbackMessages,
  step,
  userLanguage,
}) => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();
  const [isListening, setIsListening] = useState(false);
  const [aiListening, setAiListening] = useState(false);
  const [aiTranscript, setAiTranscript] = useState("");
  const [generateResponse, setGenerateResponse] = useState(false);
  const { resetMessages, messages, submitPrompt } = useChatCompletion({
    response_format: { type: "json_object" },
  });

  // New variables for educational material
  const {
    resetMessages: resetEducationalMessages,
    messages: educationalMessages,
    submitPrompt: submitEducationalPrompt,
  } = useChatCompletion({
    response_format: { type: "json_object" },
  });

  const [educationalContent, setEducationalContent] = useState([]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const pauseTimeoutRef = useRef(null);

  useEffect(() => {
    let modifiedTranscript = transcript;

    if (isCodeEditor) {
      modifiedTranscript = applySymbolMappings(modifiedTranscript);
    }

    if (listening && !aiListening) {
      onChange(modifiedTranscript);
    } else if (listening && aiListening) {
      setAiTranscript(modifiedTranscript);
      onChange(modifiedTranscript); // Display AI transcript in the input field
    }

    // Reset the timeout whenever the transcript changes
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    if (aiListening && modifiedTranscript) {
      pauseTimeoutRef.current = setTimeout(() => {
        handleAiStop();
      }, 1000); // 1 second
    } else if (isListening && modifiedTranscript) {
      pauseTimeoutRef.current = setTimeout(() => {
        handleVoiceStop();
      }, 1000); // 1 second
    }
  }, [transcript, listening, onChange, isCodeEditor, aiListening]);

  useEffect(() => {
    if (!listening && isListening) {
      setIsListening(false);
    } else if (!listening && aiListening) {
      setAiListening(false);
    }
  }, [listening]);

  useEffect(() => {
    if (generateResponse) {
      handleGenerateResponse();
    }
  }, [generateResponse]);

  if (!browserSupportsSpeechRecognition || !browserSupportsSpeechRecognition) {
    alert("Your browser doesn't support speech recognition.");
    return <span>Your browser doesn't support speech recognition.</span>;
  }

  const handleVoiceStart = () => {
    resetFeedbackMessages();
    setFeedback("");
    setIsListening(true);
    setAiListening(false);
    resetTranscript();
    resetMessages();
    onChange(""); // Clear input when starting voice
    SpeechRecognition.startListening({
      continuous: true,
      language: userLanguage === "en" ? "en-US" : "es-MX",
    });
  };

  const handleVoiceStop = () => {
    setIsListening(false);
    SpeechRecognition.stopListening();
    let finalTranscript = transcript;
    if (isCodeEditor) {
      finalTranscript = applySymbolMappings(finalTranscript);
    }
    resetTranscript();
    resetMessages();
    onChange(finalTranscript.toLocaleLowerCase());
  };

  const handleAiStart = () => {
    resetFeedbackMessages();
    setFeedback("");
    setAiListening(true);
    setIsListening(false);
    resetTranscript();
    resetMessages();
    onChange(""); // Clear input when starting AI
    SpeechRecognition.startListening({
      continuous: true,
      language: userLanguage === "en" ? "en-US" : "es-MX",
    });
  };

  const handleAiStop = () => {
    setAiListening(false);
    SpeechRecognition.stopListening();
    setGenerateResponse(true); // Set flag to generate response
  };

  const handleGenerateResponse = async () => {
    try {
      await submitPrompt([
        {
          content:
            aiTranscript +
            ` The JSON format should be { input: "${aiTranscript}", output: "your_answer" }. The output should strictly answer what is requested in javascript. Absolutely no other text or data should be included or communicated. Lastly the user is speaking in ${
              userLanguage === "en" ? "english" : "spanish"
            }`,
          role: "user",
        },
      ]);
    } catch (error) {
      console.error("Error fetching answer:", error);
    }
    setAiTranscript("");
    setGenerateResponse(false); // Reset flag
  };

  useEffect(() => {
    if (resetVoiceState) {
      setIsListening(false);
      setAiListening(false);
      SpeechRecognition.stopListening();
    }
  }, [resetVoiceState]);

  useEffect(() => {
    if (stopListening && (isListening || aiListening)) {
      handleVoiceStop();
      handleAiStop();
    }
  }, [stopListening]);

  useEffect(() => {
    if (messages?.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.meta.loading) {
        const jsonResponse = JSON.parse(lastMessage.content);
        onChange(jsonResponse.output); // Replace the input with the final output
      } else {
        onChange(lastMessage.content); // Stream the response as it comes in
      }
    }
  }, [messages, onChange]);

  // New function for handling the "Learn" button click
  const handleLearnClick = async () => {
    onOpen();
    await submitEducationalPrompt([
      {
        content: `Generate educational material about ${JSON.stringify(
          step
        )} with code examples and explanations. Make it enriching and create a useful flow where the ideas build off of each other tom encourage challenge and learning. The JSON format should be { input: "${JSON.stringify(
          step
        )}", output: [{ code: "code_example", explanation: "explanation" }] }. Additionally the code should consider line breaks and formatting because it will be formatted after completion. Lastly the user is speaking in ${
          userLanguage === "en" ? "english" : "spanish"
        }`,
        role: "user",
      },
    ]);
  };

  useEffect(() => {
    if (educationalMessages?.length > 0) {
      const lastMessage = educationalMessages[educationalMessages.length - 1];
      if (!lastMessage.meta.loading) {
        const jsonResponse = JSON.parse(lastMessage.content);
        if (Array.isArray(jsonResponse.output)) {
          setEducationalContent(jsonResponse.output);
        } else {
          setEducationalContent([]);
        }
      } else {
        setEducationalContent([]);
      }
    }
  }, [educationalMessages]);

  return (
    <VStack spacing={4} alignItems="center" width="100%" maxWidth={"600px"}>
      {useVoice || isTerminal ? (
        <HStack spacing={4} justifyContent={"center"} maxWidth={"400px"}>
          <Button
            onMouseDown={handleVoiceStart}
            colorScheme="purple"
            variant={"outline"}
          >
            {translation[userLanguage]["app.button.voiceToText"]}
          </Button>
          <Button
            onMouseDown={handleAiStart}
            colorScheme="purple"
            variant={"outline"}
          >
            {" "}
            {translation[userLanguage]["app.button.voiceToAI"]}
          </Button>
          <Button colorScheme="purple" onMouseDown={handleLearnClick}>
            {translation[userLanguage]["app.button.learn"]}
          </Button>
        </HStack>
      ) : null}

      {isListening && (
        <HStack spacing={2} alignItems="center">
          <SunsetCanvas />
          <small> {translation[userLanguage]["app.listening"]}</small>
        </HStack>
      )}
      {aiListening && (
        <HStack spacing={2} alignItems="center">
          <SunsetCanvas />
          <small> {translation[userLanguage]["app.listening"]}</small>
        </HStack>
      )}

      {isCodeEditor ? (
        <Box width="99%" height="400px" style={{ border: "1px solid #f0f0f0" }}>
          <MonacoEditor
            height="100%"
            width="100%"
            language="javascript"
            theme="light"
            value={value}
            onChange={(value) => onChange(value, resetMessages)}
            options={{
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </Box>
      ) : (
        <Textarea
          type="textarea"
          maxWidth={"333px"}
          height={"150px"}
          value={aiListening ? aiTranscript : value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={translation[userLanguage]["app.input.placeholder"]}
          width="100%"
        />
      )}

      <EducationalModal
        isOpen={isOpen}
        onClose={onClose}
        educationalMessages={educationalMessages}
        educationalContent={educationalContent}
        userLanguage={userLanguage}
      />
    </VStack>
  );
};

const fileSystem = {
  "/": {
    home: {
      user: {
        documents: {
          "file1.txt": "This is the content of file1.txt",
          "file2.txt": "This is the content of file2.txt",
        },
        pictures: {},
      },
    },
    etc: {
      config: {
        "config1.cfg": "",
        "config2.cfg": "",
      },
    },
    var: {
      log: {
        "log1.log": "",
        "log2.log": "",
      },
    },
  },
};

const envVariables = {
  USER: "mockuser",
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
};

function TerminalComponent({
  inputValue,
  setInputValue,
  isSending,
  isTerminal,
  resetVoiceState,
  stopListening,
  setFeedback,
  resetFeedbackMessages,
  step,
  userLanguage,
}) {
  const [structure, setStructure] = useState(fileSystem);
  const [history, setHistory] = useState([
    {
      value: translation[userLanguage]["mockTerminal.welcomeMessage"],
    },
  ]);
  const [cwd, setCwd] = useState("/");

  useEffect(() => {
    if (isSending) {
      executeCommand(inputValue);
    }
  }, [isSending]);

  const executeCommand = (command) => {
    const parts = command.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    const customSetup = {
      help: {
        exec: () => {
          setHistory([
            ...history,
            {
              value: translation[userLanguage]["mockTerminal.help"],
            },
          ]);
        },
      },
      clear: {
        exec: () => {
          setHistory([]);
        },
      },
      ls: {
        exec: () => {
          const currentDir =
            cwd === "/"
              ? structure
              : cwd
                  .split("/")
                  .filter((p) => p)
                  .reduce((acc, dir) => acc[dir], structure);
          const content = Object.keys(currentDir).join("  ");
          setHistory([...history, { value: content }]);
        },
      },
      cat: {
        exec: () => {
          const filePath = args[0];
          const fileContent = filePath
            .split("/")
            .filter((p) => p)
            .reduce((acc, dir) => acc[dir], structure);
          if (typeof fileContent === "string") {
            setHistory([...history, { value: fileContent }]);
          } else {
            setHistory([
              ...history,
              {
                value: `cat: ${filePath}: ${translation[userLanguage]["mockTerminal.noSuchFile"]}`,
              },
            ]);
          }
        },
      },
      mkdir: {
        exec: () => {
          const newDir = args[0];
          const currentDir =
            cwd === "/"
              ? structure
              : cwd
                  .split("/")
                  .filter((p) => p)
                  .reduce((acc, dir) => acc[dir], structure);

          if (!currentDir[newDir]) {
            currentDir[newDir] = {};
            setStructure({ ...structure });
            setHistory([
              ...history,
              {
                value: `${translation[userLanguage]["mockTerminal.directory"]} ${newDir} created.`,
              },
            ]);
          } else {
            setHistory([
              ...history,
              {
                value: `bash: mkdir: cannot create directory '${newDir}': File exists`,
              },
            ]);
          }
        },
      },
      cd: {
        exec: () => {
          const newDir = args[0] || "/";
          const path = newDir === "/" ? [] : newDir.split("/").filter((p) => p);
          let currentDir = structure;
          let newCwd = "/";

          for (let i = 0; i < path.length; i++) {
            if (currentDir[path[i]]) {
              currentDir = currentDir[path[i]];
              newCwd += (newCwd === "/" ? "" : "/") + path[i];
            } else {
              setHistory([
                ...history,
                {
                  value: `bash: cd: ${newDir}: No such file or directory`,
                },
              ]);
              return;
            }
          }

          setCwd(newCwd);
          setHistory([...history, { value: `user@mock-terminal:${newCwd}$` }]);
        },
      },
      pwd: {
        exec: () => {
          setHistory([...history, { value: cwd }]);
        },
      },
      echo: {
        exec: () => {
          const message = args.join(" ");
          setHistory([...history, { value: message }]);
        },
      },
      printenv: {
        exec: () => {
          const envList = Object.entries(envVariables)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");
          setHistory([...history, { value: envList }]);
        },
      },
      whoami: {
        exec: () => {
          setHistory([...history, { value: envVariables.USER }]);
        },
      },
    };

    if (customSetup[cmd]) {
      customSetup[cmd].exec();
    } else {
      setHistory([...history, { value: `bash: ${cmd}: command not found` }]);
    }
  };

  useEffect(() => {
    const commands = ["mkdir new_folder"];

    commands.forEach((command) => {
      const parts = command.split(" ");
      const cmd = parts[0];
      const arg = parts[1];

      const customExtensions = {
        mkdir: {
          exec: ({ structure, history, cwd }, command) => {
            const args = command.split(" ");
            const newDir = args[1];
            const currentDir =
              cwd === "/"
                ? structure
                : cwd
                    .split("/")
                    .filter((p) => p)
                    .reduce((acc, dir) => acc[dir], structure);

            if (!currentDir[newDir]) {
              currentDir[newDir] = {};
              setStructure({ ...structure });
              setHistory([
                ...history,
                {
                  value: `${translation[userLanguage]["mockTerminal.directory"]} ${newDir} created.`,
                },
              ]);
            } else {
              setHistory([
                ...history,
                {
                  value: `bash: mkdir: cannot create directory '${newDir}': File exists`,
                },
              ]);
            }
          },
        },
        touch: {
          exec: ({ structure, history, cwd }, command) => {
            const args = command.split(" ");
            const newFile = args[1];
            const currentDir =
              cwd === "/"
                ? structure
                : cwd
                    .split("/")
                    .filter((p) => p)
                    .reduce((acc, dir) => acc[dir], structure);

            if (!currentDir[newFile]) {
              currentDir[newFile] = "";
              setStructure({ ...structure });
              setHistory([...history, { value: `File ${newFile} created.` }]);
            } else {
              setHistory([
                ...history,
                {
                  value: `bash: touch: cannot create file '${newFile}': File exists`,
                },
              ]);
            }
          },
        },
      };

      customExtensions[cmd].exec({ structure, history, cwd }, command);
    });
  }, []);

  return (
    <>
      <VoiceInput
        value={inputValue}
        onChange={setInputValue}
        isCodeEditor={false}
        isTerminal={isTerminal}
        resetVoiceState={resetVoiceState}
        stopListening={stopListening}
        setFeedback={setFeedback}
        resetFeedbackMessages={resetFeedbackMessages}
        step={step}
        userLanguage={userLanguage}
      />
      <div
        style={{ width: "100%", maxWidth: "600px", marginTop: 12, height: 300 }}
      >
        <ReactBash
          structure={structure}
          history={history}
          prefix={`${translation[userLanguage]["mockTerminal.userName"]}${cwd}$`}
        />
      </div>
    </>
  );
}

const Step = ({
  currentStep,
  userLanguage,
  setUserLanguage,
  postNostrContent,
}) => {
  const { stepIndex } = useParams();
  const currentStepIndex = parseInt(stepIndex, 10);
  const [inputValue, setInputValue] = useState("");
  const [selectedOption, setSelectedOption] = useState(""); // For Multiple Choice
  const [items, setItems] = useState([]); // For Select Order
  const [isSending, setIsSending] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [resetVoiceState, setResetVoiceState] = useState(false);
  const [stopListening, setStopListening] = useState(false);
  const [streak, setStreak] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [interval, setInterval] = useState(0);
  const { cashTap } = useCashuWallet(true);

  const { resetMessages, messages, submitPrompt } = useChatCompletion({
    response_format: { type: "json_object" },
  });

  const navigate = useNavigate();
  const step = steps[userLanguage][currentStep];

  // Fetch user data and manage streaks and timers
  useEffect(() => {
    const fetchUserData = async () => {
      const userId = localStorage.getItem("local_npub");
      const userData = await getUserData(userId);

      setStreak(userData.streak || 0);
      setStartTime(new Date(userData.startTime));
      setEndTime(new Date(userData.endTime));
      setInterval(userData.timer || 0);

      const currentTime = new Date();
      if (currentTime > new Date(userData.endTime)) {
        setStreak(0);
        const newEndTime = new Date(
          currentTime.getTime() + (userData.timer || 0) * 60000
        );
        setStartTime(currentTime);
        setEndTime(newEndTime);
        await updateUserData(
          userId,
          userData.timer,
          0,
          currentTime,
          newEndTime
        );
      }
    };

    fetchUserData();
  }, []);

  // Initialize items for Select Order question
  useEffect(() => {
    if (step.isSelectOrder) {
      setItems(step.question.options.sort(() => Math.random() - 0.5));
    }
  }, [step]);

  // Calculate progress through the steps
  const calculateProgress = () => {
    return ((currentStep - 1) / (steps[userLanguage].length - 1)) * 100;
  };

  // Handle input change
  const handleInputChange = (value, resetter = null) => {
    setInputValue(value);
    if (resetter) {
      resetter();
    }
  };

  // Handle answer submission
  const handleAnswerClick = async () => {
    setIsSending(true);
    setResetVoiceState(true);
    setStopListening(true);

    let answer = inputValue;
    if (step.isMultipleChoice) {
      answer = selectedOption;
    } else if (step.isSelectOrder) {
      answer = items;
    }

    console.log("answer", answer);

    if (step.isMultipleChoice || step.isSelectOrder) {
      await submitPrompt([
        {
          content: `The user is answering the following question "${
            step.question.questionText
          }". The answer to the question is ${step.question.answer}
        and the user provided the following answer "${answer}". Is this answer correct? Return the response using a json interface like { isCorrect: boolean, feedback: string }. Do not include the answer or solution in your feedback but suggest or direct the user in the right direction. The user is speaking ${
            userLanguage === "es" ? "spanish" : "english"
          }.`,
          role: "user",
        },
      ]);
    } else {
      await submitPrompt([
        {
          content: `The user is answering the following question "${
            step.question.questionText
          }" with the following answer "${answer}". Is this answer correct? Return the response using a json interface like { isCorrect: boolean, feedback: string }. Do not include the answer or solution in your feedback but suggest or direct the user in the right direction. The user is speaking ${
            userLanguage === "es" ? "spanish" : "english"
          }.`,
          role: "user",
        },
      ]);
    }
    cashTap();

    setInputValue("");
    setSelectedOption(""); // Reset the selected option after submission
    setIsSending(false);
    setResetVoiceState(false);
  };

  // Store correct answers in the database
  const storeCorrectAnswer = async (step, answer) => {
    const userId = localStorage.getItem("local_npub");
    const answerRef = collection(database, `users/${userId}/answers`);
    await addDoc(answerRef, {
      step: currentStep,
      question: step.question.questionText,
      correctAnswer: answer,
      timestamp: new Date(),
    });

    const currentTime = new Date();
    let newStreak = streak;

    if (currentTime <= new Date(endTime)) {
      newStreak += 1; // Increment streak if within time
    } else {
      newStreak = 1; // Reset streak if not within time
    }

    const newEndTime = new Date(currentTime.getTime() + interval * 60000);
    setStartTime(currentTime);
    setEndTime(newEndTime);
    setStreak(newStreak);

    await updateUserData(userId, interval, newStreak, currentTime, newEndTime);
  };

  // Stream messages and handle feedback
  useEffect(() => {
    if (messages?.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.meta.loading) {
        const jsonResponse = JSON.parse(lastMessage.content);

        setIsCorrect(jsonResponse.isCorrect);
        setFeedback(jsonResponse.feedback);

        if (jsonResponse.isCorrect) {
          const npub = localStorage.getItem("local_npub");
          incrementUserStep(npub);
          storeCorrectAnswer(step, jsonResponse.feedback);
        }
      }
    }
  }, [messages]);

  // Reset state for a new step
  useEffect(() => {
    setInputValue("");
    setFeedback("");
    setIsCorrect(null);
    resetMessages();
  }, [step]);

  // Navigate to the next step
  const handleNextClick = async () => {
    if (currentStep === steps.length - 1) {
      navigate("/award");
    } else {
      await postNostrContent(
        `I just completed question ${currentStep} on https://program-ai.app\n\n---\n\n${step.question?.questionText}`
      );
      navigate(`/q/${currentStep + 1}`);
    }
  };

  // Navigate back to the previous step
  const handleBackClick = () => {
    if (currentStep === 1) {
      navigate(`/`);
    } else {
      navigate(`/q/${currentStep - 1}`);
    }
  };

  const {
    resetMessages: resetEducationalMessages,
    messages: educationalMessages,
    submitPrompt: submitEducationalPrompt,
  } = useChatCompletion({
    response_format: { type: "json_object" },
  });

  const [educationalContent, setEducationalContent] = useState([]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  // New function for handling the "Learn" button click
  const handleLearnClick = async () => {
    onOpen();
    await submitEducationalPrompt([
      {
        content: `Generate educational material about ${JSON.stringify(
          step
        )} with code examples and explanations. Make it enriching and create a useful flow where the ideas build off of each other tom encourage challenge and learning. The JSON format should be { input: "${JSON.stringify(
          step
        )}", output: [{ code: "code_example", explanation: "explanation" }] }. Additionally the code should consider line breaks and formatting because it will be formatted after completion. Lastly the user is speaking in ${
          userLanguage === "en" ? "english" : "spanish"
        }`,
        role: "user",
      },
    ]);
  };

  useEffect(() => {
    if (educationalMessages?.length > 0) {
      const lastMessage = educationalMessages[educationalMessages.length - 1];
      if (!lastMessage.meta.loading) {
        const jsonResponse = JSON.parse(lastMessage.content);
        if (Array.isArray(jsonResponse.output)) {
          setEducationalContent(jsonResponse.output);
        } else {
          setEducationalContent([]);
        }
      } else {
        setEducationalContent([]);
      }
    }
  }, [educationalMessages]);

  return (
    <VStack spacing={4} width="100%" mt={24}>
      <VStack textAlign={"left"} style={{ width: "100%", maxWidth: 400 }}>
        <b style={{ fontSize: "60%" }}>
          {translation[userLanguage]["app.progress"]} :{" "}
          {calculateProgress().toFixed(2)}% |{" "}
          {translation[userLanguage]["app.streak"]}: {streak}
        </b>
        <Progress
          value={calculateProgress()}
          size="xs"
          colorScheme="purple"
          width="100%"
          mb={4}
        />
      </VStack>
      <Text fontSize="xl">
        {currentStep}. {step.title}
      </Text>
      {step.question && (
        <Text style={{ width: "100%", maxWidth: 600 }} fontSize="sm">
          {step.question.questionText}
        </Text>
      )}

      {step.isText && (
        <VoiceInput
          value={inputValue}
          onChange={setInputValue}
          isCodeEditor={false}
          isTextInput={true}
          resetVoiceState={resetVoiceState}
          useVoice={true}
          stopListening={stopListening}
          setFeedback={setFeedback}
          resetFeedbackMessages={resetMessages}
          step={step}
          userLanguage={userLanguage}
        />
      )}
      {step.isCode && !step.isTerminal && (
        <VoiceInput
          value={inputValue}
          onChange={setInputValue}
          isCodeEditor={true}
          resetVoiceState={resetVoiceState}
          useVoice={true}
          stopListening={stopListening}
          setFeedback={setFeedback}
          resetFeedbackMessages={resetMessages}
          step={step}
          userLanguage={userLanguage}
        />
      )}
      {step.isCode && step.isTerminal && (
        <Box
          width="100%"
          justifyContent="center"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <TerminalComponent
            inputValue={inputValue}
            setInputValue={setInputValue}
            isSending={isSending}
            isTerminal={true}
            stopListening={stopListening}
            resetVoiceState={resetVoiceState}
            setFeedback={setFeedback}
            resetFeedbackMessages={resetMessages}
            step={step}
            userLanguage={userLanguage}
          />
        </Box>
      )}
      {step.isMultipleChoice && (
        <MultipleChoiceQuestion
          question={step.question}
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          userLanguage={userLanguage}
          onLearnClick={handleLearnClick}
        />
      )}
      {step.isSelectOrder && (
        <SelectOrderQuestion
          items={items}
          setItems={setItems}
          onLearnClick={handleLearnClick}
          userLanguage={userLanguage}
          step={step}
        />
      )}
      <HStack spacing={4}>
        {step.title === "Welcome to the Program AI App!" ? (
          <Button colorScheme="purple" onMouseDown={handleNextClick}>
            Let's start
          </Button>
        ) : (
          step.question && (
            <Button onClick={handleAnswerClick} isLoading={isSending}>
              {translation[userLanguage]["app.button.answer"]}
            </Button>
          )
        )}
        {isCorrect && (
          <Button variant={"outline"} onMouseDown={handleNextClick}>
            {translation[userLanguage]["app.button.nextQuestion"]}{" "}
          </Button>
        )}
      </HStack>
      {messages.length > 0 && !feedback && (
        <Box mt={4} p={4} borderRadius="lg" width="100%" maxWidth="640px">
          <Text>{messages[messages.length - 1]?.content}</Text>
        </Box>
      )}
      {feedback && (
        <Box mt={4} p={4} borderRadius="lg" width="100%" maxWidth="640px">
          <Text color={isCorrect ? "green.500" : "red.500"}>{feedback}</Text>
        </Box>
      )}

      <EducationalModal
        isOpen={isOpen}
        onClose={onClose}
        educationalMessages={educationalMessages}
        educationalContent={educationalContent}
        userLanguage={userLanguage}
      />
    </VStack>
  );
};

const Home = ({
  isSignedIn,
  setIsSignedIn,
  userLanguage,
  setUserLanguage,
  generateNostrKeys,
  auth,
}) => {
  const [view, setView] = useState("buttons");
  const [userName, setUserName] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [keys, setKeys] = useState(null);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // localStorage.getItem("local_npub"),
  // localStorage.getItem("local_nsec")

  const navigate = useNavigate();
  const toast = useToast();
  // const { width, height } = useWindow();

  const handleCreateAccount = async () => {
    setIsCreatingAccount(true);
    const newKeys = await generateNostrKeys(userName);
    setKeys(newKeys);

    localStorage.setItem("displayName", userName);
    setIsSignedIn(true);

    // Create user in Firestore with language preference
    await createUser(newKeys.npub, userName, userLanguage);
    setView("created");
    setIsCreatingAccount(false);
  };

  const handleSignIn = async () => {
    await auth(secretKey);
    const npub = localStorage.getItem("local_npub");
    const userName = localStorage.getItem("displayName");

    // Check if user exists in Firestore and create if necessary
    const userDoc = doc(database, "users", npub);
    const userSnapshot = await getDoc(userDoc);
    if (!userSnapshot.exists()) {
      await createUser(npub, userName, userLanguage);
    }

    const currentStep = await getUserStep(npub); // Retrieve the current step
    setIsSignedIn(true);
    navigate(`/q/${currentStep}`); // Navigate to the user's current step
  };

  const handleCheckboxChange = (event) => {
    setIsCheckboxChecked(event.target.checked);
  };

  const handleLaunchApp = () => {
    if (isCheckboxChecked) {
      navigate("/q/1");
    }
  };

  const handleCopyKeys = () => {
    const keysToCopy = `${keys.privateKey}`;
    navigator.clipboard.writeText(keysToCopy);
    toast({
      title: translation[userLanguage]["toast.title.keysCopied"],
      description: translation[userLanguage]["toast.description.keysCopied"],
      status: "success",
      duration: 1500,
      isClosable: true,
      position: "top",
    });
  };

  useEffect(() => {
    if (view === "buttons" || view === "createAccount") {
      setIsSignedIn(false);
      const translateValue = localStorage.getItem("userLanguage");
      localStorage.clear();
      if (translateValue) {
        localStorage.setItem("userLanguage", translateValue);
      }
    }
  }, [view]);

  const handleToggle = async () => {
    const newLanguage = userLanguage === "en" ? "es" : "en";
    setUserLanguage(newLanguage);

    // Update local storage
    localStorage.setItem("userLanguage", newLanguage);

    // Update Firestore
    const npub = localStorage.getItem("local_npub");
    if (npub) {
      const userDoc = doc(database, "users", npub);
      await updateDoc(userDoc, {
        language: newLanguage,
      });
    }
  };

  return (
    <Box
      textAlign="center"
      p={0}
      style={{
        height: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {view === "buttons" && (
        <>
          <VStack spacing={4}>
            <VStack spacing={4} width="95%" maxWidth="720px">
              <HStack spacing={2} alignItems="center">
                <SunsetCanvas />
              </HStack>
              <Text fontSize="2xl">
                {translation[userLanguage]["landing.welcome"]}
              </Text>
              <Text fontSize="sm">
                {translation[userLanguage]["landing.introduction"]}
              </Text>
              <FormControl
                display="flex"
                alignItems="center"
                style={{ justifyContent: "center" }}
                m={2}
              >
                <FormLabel htmlFor="language-toggle" mb="0">
                  {userLanguage === "en" ? "English" : "Español"}
                </FormLabel>
                <Switch
                  colorScheme="purple"
                  id="language-toggle"
                  isChecked={userLanguage === "es"}
                  onChange={handleToggle}
                />
              </FormControl>
            </VStack>

            <HStack>
              <Button
                colorScheme="purple"
                variant={"outline"}
                onMouseDown={() => setView("createAccount")}
              >
                {translation[userLanguage]["landing.button.createAccount"]}
              </Button>
              <Button
                colorScheme="purple"
                variant={"outline"}
                onClick={() => setView("signIn")}
              >
                {translation[userLanguage]["landing.button.signIn"]}{" "}
              </Button>
            </HStack>
          </VStack>
          {isUnsupportedBrowser() ? (
            <>
              <br />
              <VStack
                p={4}
                pt={8}
                style={{
                  backgroundColor: "rgba(207,124,208, 1)",
                  color: "white",
                  borderRadius: "64px",
                }}
              >
                <Heading size="lg">
                  {translation[userLanguage]["badBrowser.header"]}{" "}
                </Heading>
                <Text p={8} pt={0} textAlign={"left"}>
                  {translation[userLanguage]["badBrowser.bodyOne"]}&nbsp;
                  {isUnsupportedBrowser()}{" "}
                  {translation[userLanguage]["badBrowser.bodyTwo"]}{" "}
                  <b>{translation[userLanguage]["badBrowser.bodyThree"]}</b>
                </Text>{" "}
                <OrderedList p={8} pt={0} textAlign={"left"}>
                  <ListItem>
                    <span style={{ display: "flex" }}>
                      <IconButton mr={"2"} isDisabled icon={<IoIosMore />} />
                      {translation[userLanguage]["badBrowser.stepOne"]}
                      &nbsp;
                    </span>
                  </ListItem>
                  <br />
                  <ListItem>
                    <span style={{ display: "flex" }}>
                      <IconButton
                        mr={"2"}
                        isDisabled
                        icon={<IoShareOutline />}
                      />
                      {translation[userLanguage]["badBrowser.stepTwo"]}
                      &nbsp;
                    </span>
                  </ListItem>
                  <br />
                  <ListItem>
                    <span style={{ display: "flex" }}>
                      <IconButton
                        mr={"2"}
                        isDisabled
                        icon={<PlusSquareIcon />}
                      />
                      {translation[userLanguage]["badBrowser.stepThree"]} &nbsp;
                    </span>
                  </ListItem>
                </OrderedList>
                <Text p={8} pt={0} textAlign={"left"}>
                  {translation[userLanguage]["badBrowser.footer"]}{" "}
                </Text>
              </VStack>
            </>
          ) : null}
        </>
      )}

      {view === "createAccount" && (
        <VStack spacing={4}>
          <div>{isCreatingAccount ? <SunsetCanvas /> : null}</div>
          <Text fontSize="sm">
            {" "}
            {translation[userLanguage]["createAccount.instructions"]}{" "}
          </Text>
          <Input
            style={{ maxWidth: 300 }}
            placeholder={
              translation[userLanguage]["createAccount.input.placeholder"]
            }
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <HStack>
            <Button variant="outline" onMouseDown={() => setView("buttons")}>
              {" "}
              {translation[userLanguage]["button.back"]}
            </Button>
            <Button
              onMouseDown={handleCreateAccount}
              colorScheme="purple"
              variant={"outline"}
            >
              {translation[userLanguage]["button.create"]}
            </Button>
          </HStack>
        </VStack>
      )}
      {view === "signIn" && (
        <VStack spacing={4}>
          <Text fontSize="sm">
            {translation[userLanguage]["signIn.instructions"]}
          </Text>
          <Input
            placeholder={translation[userLanguage]["signIn.input.placeholder"]}
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <HStack>
            <Button variant="outline" onMouseDown={() => setView("buttons")}>
              {translation[userLanguage]["button.back"]}
            </Button>
            <Button
              onClick={handleSignIn}
              colorScheme="purple"
              variant={"outline"}
            >
              {translation[userLanguage]["landing.button.signIn"]}
            </Button>
          </HStack>
        </VStack>
      )}
      {view === "created" && keys && (
        <VStack spacing={4}>
          <Confetti
            numberOfPieces={300}
            recycle={false}
            colors={["#FFCCCC", "#CCEFFF", "#D9A8FF", "#FF99CC", "#FFD1B3"]} // Array of colors matching the logo
          />
          <Text width="95%" maxWidth="720px">
            {translation[userLanguage]["createAccount.successMessage"]} <br />
            <Text fontSize="sm">
              {translation[userLanguage]["createAccount.awareness"]}
              {isCheckboxChecked ? (
                <Link
                  href="https://robotsbuildingeducation.com"
                  color="teal.500"
                  style={{ textDecoration: "underline" }}
                >
                  {translation[userLanguage]["createAccount.roxLink"]}
                </Link>
              ) : (
                translation[userLanguage]["createAccount.roxLink"]
              )}{" "}
              {translation[userLanguage]["or"] + " "}
              {isCheckboxChecked ? (
                <Link
                  href="https://primal.net/home"
                  color="teal.500"
                  style={{ textDecoration: "underline" }}
                >
                  {translation[userLanguage]["createAccount.primalLink"]}
                </Link>
              ) : (
                translation[userLanguage]["createAccount.primalLink"]
              )}
              .
            </Text>
          </Text>
          <Button onMouseDown={handleCopyKeys}>
            🔑 {translation[userLanguage]["button.copyKey"]}
          </Button>

          <HStack>
            <Checkbox
              colorScheme="purple"
              direction="row"
              isChecked={isCheckboxChecked}
              onChange={handleCheckboxChange}
              style={{ textAlign: "left" }}
              width="95%"
              maxWidth="350px"
            >
              <Text fontSize="x-small" fontWeight={"bolder"}>
                {translation[userLanguage]["createAccount.checkbox.disclaimer"]}
              </Text>
            </Checkbox>
          </HStack>
          <HStack>
            <Button
              variant="outline"
              onMouseDown={() => setView("createAccount")}
            >
              {" "}
              {translation[userLanguage]["button.back"]}
            </Button>
            <Button
              onMouseDown={handleLaunchApp}
              isDisabled={!isCheckboxChecked}
              colorScheme="purple"
              variant={"outline"}
            >
              {translation[userLanguage]["createAccount.button.launchApp"]}
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  );
};

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0); // State to store current step
  const [userLanguage, setUserLanguage] = useState("en"); // State to store user language preference
  const navigate = useNavigate();

  const { generateNostrKeys, auth, postNostrContent } = useSharedNostr(
    localStorage.getItem("local_npub"),
    localStorage.getItem("local_nsec")
  );

  useEffect(() => {
    const initializeApp = async () => {
      const npub = localStorage.getItem("local_npub");
      if (npub && window.location.pathname !== "/dashboard") {
        auth(localStorage.getItem("local_nsec"));
        setIsSignedIn(true);
        const step = await getUserStep(npub); // Fetch the current step
        setCurrentStep(step);

        // Fetch user language preference
        const userDoc = doc(database, "users", npub);
        const userSnapshot = await getDoc(userDoc);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setUserLanguage(userData.userLanguage || "en"); // Set user language preference
          localStorage.setItem("userLanguage", userData.userLanguage);
        }

        navigate(`/q/${step}`);
      }

      if (localStorage.getItem("userLanguage")) {
        setUserLanguage(localStorage.getItem("userLanguage") || "en");
      } else {
        localStorage.setItem("userLanguage", "en");
      }
      setLoading(false);
    };

    initializeApp();
  }, [navigate]);

  if (loading) {
    return (
      <Box
        style={{
          display: "flex",
          justifyContent: "center",
          height: "100vh",
          alignItems: "center",
        }}
        textAlign="center"
        fontSize="xl"
        p={4}
      >
        <SunsetCanvas />
      </Box>
    );
  }

  return (
    <Box textAlign="center" fontSize="xl" p={4}>
      {isSignedIn && (
        <SettingsMenu
          isSignedIn={isSignedIn}
          setIsSignedIn={setIsSignedIn}
          steps={steps}
          userLanguage={userLanguage}
          setUserLanguage={setUserLanguage}
          currentStep={currentStep} // Pass current step to SettingsMenu
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Home
              isSignedIn={isSignedIn}
              setIsSignedIn={setIsSignedIn}
              userLanguage={userLanguage}
              setUserLanguage={setUserLanguage}
              generateNostrKeys={generateNostrKeys}
              auth={auth}
            />
          }
        />
        {steps?.[userLanguage]?.map((_, index) => (
          <Route
            key={index}
            path={`/q/${index}`}
            element={
              <PrivateRoute>
                <Step
                  currentStep={index}
                  userLanguage={userLanguage}
                  setUserLanguage={setUserLanguage}
                  postNostrContent={postNostrContent}
                />
              </PrivateRoute>
            }
          />
        ))}
        <Route path="/award" element={<AwardScreen />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Box>
  );
}

export const AppWrapper = () => {
  return (
    <Router>
      <App />
    </Router>
  );
};
