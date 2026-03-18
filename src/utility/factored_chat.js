import { Message } from "../models/message.model.js";

export const factoredChat = async(chat, apiCallee)=> {
    const chatObj = chat.toObject ? chat.toObject() : chat;

    // Setting chat title and image manually
    chatObj.title = "";
    for(let i = 0; i < chat.participants.length; i++){
        if(chat.participants[i]._id.toString() !== apiCallee.toString()){
          chatObj.imageUrl = chat.participants[i].profileImage;
          if(chatObj.title !== "") chatObj.title += ", ";
          chatObj.title += chat.participants[i].name;
          break;
        }
    }

    const hasMessage = await Message.exists({ chatId: chat._id });
    if (chatObj.lastMessage && hasMessage) {
      chatObj.lastMessage.isMe =
        chatObj.lastMessage.sender._id.toString() === apiCallee.toString();
    }
    console.log("Factored chat ", chatObj.toString());
    return chatObj;
}

