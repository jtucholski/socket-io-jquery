let FADE_TIME = 150; // ms
let TYPING_TIMER_LENGTH = 400; // ms
let COLORS = [
  "#e21400",
  "#91580f",
  "#f8a700",
  "#f78b00",
  "#58dc00",
  "#287b00",
  "#a8f07a",
  "#4ae8c4",
  "#3b88eb",
  "#3824aa",
  "#a700ff",
  "#d300e7",
];


// Similar to DOMContentLoaded
$(function () {

  // Initialize variables used for the page.
  let $window = $(window);
  let $usernameInput = $(".usernameInput"); // Input for username
  let $messages = $(".messages"); // Messages area
  let $inputMessage = $(".inputMessage"); // Input message input box

  let $loginPage = $(".login.page"); // The login page
  let $chatPage = $(".chat.page"); // The chatroom page

  // Prompt for setting a username
  let username;
  let connected = false;
  let typing = false;
  let lastTypingTime;
  let $currentInput = $usernameInput.focus();

  // Establish the WebSocket Connection
  let socket = io();

  /* All of our functions to help handle Socket Events */
  /**
   * Adds number of participants to the chat to the screen.
   * @param {Object} data The data object representing state.
   */
  const addParticipantsMessage = (data) => {
    let message = "";
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  };

  /**
   * Sets the user's name to session and moves to the chat screen.
   * Notifies the websocket server a user is to be added.
   */
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off("click");
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit("add user", username);
    }
  };

/**
 * If connected, we'll send a message to the websocket server that
 * a new message was added.
 */
  const sendMessage = () => {
    let message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {      
      $inputMessage.val("");
      addChatMessage({
        username: username,
        message: message,
      });
      // tell server to execute 'new message', sending along the message
      socket.emit("new message", message);
    }
  };

  /**
   * Adds a new message to the chat interface.
   * @param {String} message The message to add to the chat window
   * @param {Object} options Properties indicating where it should be added.
   */
  const log = (message, options) => {
    let $el = $("<li>").addClass("log").text(message);
    addMessageElement($el, options);
  };

  /**
   * Builds up the element that ultimately gets added to the chat message window.
   * @param {Object} data Information about the incoming chat message to be added (username, message)
   * @param {Object} options Information about how to display the new message
   */
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    let $typingMessages = getTypingMessages(data.username);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    let $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css("color", getUsernameColor(data.username));
    let $messageBodyDiv = $('<span class="messageBody">').text(data.message);

    let typingClass = data.typing ? "typing" : "";
    let $messageDiv = $('<li class="message"/>')
      .data("username", data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  };

  /**
   * Adds a new message element to the messages and scrolls to the bottom
   * @param {HtmlElement} el The element to add as a message
   * @param {Object} options How the element should be added (fade, prepend)
   */
  const addMessageElement = (el, options) => {
    let $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === "undefined") {
      options.fade = true;
    }
    if (typeof options.prepend === "undefined") {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  };


  // KEYBOARD EVENTS

  $window.keydown((event) => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) { // then we're in the chat screen
        sendMessage();
        socket.emit("stop typing");
        typing = false;
      } else {
        setUsername();
      }
    }
  });


  $inputMessage.on("input", () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit("typing");
      }
      lastTypingTime = new Date().getTime();

      // We need to detect if the user has stopped typing
      // (no activity in TYPING_TIMER_LENGTH)
      setTimeout(() => {
        let typingTimer = new Date().getTime();
        let timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit("stop typing");
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  });

  // CLICK EVENTS

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });

  // SOCKET EVENTS
  
  // Whenever the server emits 'login', log the login message
  socket.on("login", (data) => {
    connected = true;
    // Display the welcome message
    let message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true,
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on("new message", (data) => {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on("user joined", (data) => {
    log(data.username + " joined");
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on("user left", (data) => {
    log(data.username + " left");
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on("typing", (data) => {
    data.typing = true;
    data.message = "is typing";
    addChatMessage(data);
    //addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on("stop typing", (data) => {
    removeChatTyping(data);
  });

  socket.on("disconnect", () => {
    log("you have been disconnected");
  });

  socket.on("reconnect", () => {
    log("you have been reconnected");
    if (username) {
      socket.emit("add user", username);
    }
  });

  socket.on("reconnect_error", () => {
    log("attempt to reconnect has failed");
  });
});

/**
 * Generates a <div> with the input as the innerText.
 * @param {String} input A new message
 * @returns {HtmlElement} The newly reated element
 */
function cleanInput(input) {
  return $("<div/>").text(input).html();
}

/**
 * Gets the typing message for a given username.
 * @param {String} username Data object about current user session 
 * @returns {HtmlElement} The typing message that would represent that user.
 */
function getTypingMessages(username) {
  return $(".typing.message").filter(function (i) {
    return $(this).data("username") === username;
  });
}

// Removes the visual chat typing message
function removeChatTyping(data) {
  getTypingMessages(data.username).fadeOut(function () {
    $(this).remove();
  });
}

/**
 * Function used to generate a hash code from the user's name to assign
 * them a unique color.
 * @param {String} username The username to get the hex color for.
 */ 
function getUsernameColor(username) {
  // Compute hash code
  let hash = 7;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + (hash << 5) - hash;
  }
  // Calculate color
  let index = Math.abs(hash % COLORS.length);
  return COLORS[index];
}
