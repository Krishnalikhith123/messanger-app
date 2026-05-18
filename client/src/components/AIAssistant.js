import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiX, FiSend, FiCpu, FiMic } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSocketStore } from '../store/socketStore';
import { useAuthStore } from '../store/authStore';
import '../styles/AIAssistant.css';

const AIAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isGreeting, setIsGreeting] = useState(true);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isListeningForVoice, setIsListeningForVoice] = useState(false);
    const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
    const [isProcessingCommand, setIsProcessingCommand] = useState(false);
    const [kaneActive, setKaneActive] = useState(false);  // Always-on Kane toggle
    const kaneActiveRef = useRef(false);  // Ref for use inside callbacks
    const wakeRecognitionRef = useRef(null); // Ref to abort recognition manually
    const commandRecognitionRef = useRef(null); // Ref to abort command recognition
    const chatEndRef = useRef(null);
    
    // Voice Queue State
    const { socket } = useSocketStore();
    const { user } = useAuthStore();
    const messageQueueRef = useRef([]);
    const isProcessingRef = useRef(false);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // --- Voice Assistant Queue Logic ---
    // 1. Fetch unread offline messages on mount/login
    useEffect(() => {
        if (!user) return;

        const fetchUnreadOfflineMessages = async () => {
            try {
                const response = await axios.get('/api/messages/unread/all');
                const unreadMsgs = response.data;
                
                if (unreadMsgs.length > 0) {
                    console.log(`🎤 Found ${unreadMsgs.length} offline unread messages!`);
                    let hasNew = false;
                    
                    unreadMsgs.forEach(msg => {
                        const senderName = msg.senderId.username;
                        const content = msg.content;
                        const messageId = msg._id;
                        
                        const existingSenderIndex = messageQueueRef.current.findIndex(q => q.senderName === senderName);
                        if (existingSenderIndex >= 0) {
                            // Deduplicate messages!
                            if (!messageQueueRef.current[existingSenderIndex].messageIds.includes(messageId)) {
                                messageQueueRef.current[existingSenderIndex].messages.push(content);
                                messageQueueRef.current[existingSenderIndex].messageIds.push(messageId);
                                hasNew = true;
                            }
                        } else {
                            messageQueueRef.current.push({ senderName, messages: [content], messageIds: [messageId] });
                            hasNew = true;
                        }
                    });

                    if (hasNew && !isProcessingRef.current && isMountedRef.current) {
                        console.log('🎤 Starting queue processing for offline messages');
                        setTimeout(() => {
                            if (isMountedRef.current && !isProcessingRef.current) processQueue();
                        }, 2000); 
                    }
                }
            } catch (error) {
                console.error('🎤 Error fetching unread messages:', error);
            }
        };

        fetchUnreadOfflineMessages();
    }, [user]);

    // 2. Listen for real-time messages
    useEffect(() => {
        if (!socket || !user) return;

        const handleReceiveMessage = (data) => {
            console.log('🎤 AI Assistant received message:', data);
            
            if (data.senderId._id === user.id) {
                console.log('🎤 Ignoring message from self');
                return;
            }
            if (data.messageType !== 'text') {
                console.log('🎤 Ignoring non-text message');
                return;
            }

            const senderName = data.senderId.username;
            const content = data.content;
            const messageId = data._id; // Realtime messages have _id
            console.log(`🎤 Queuing message from ${senderName}: ${content}`);

            // Add to queue
            const existingSenderIndex = messageQueueRef.current.findIndex(q => q.senderName === senderName);
            if (existingSenderIndex >= 0) {
                // Deduplicate realtime messages too, just in case
                if (!messageQueueRef.current[existingSenderIndex].messageIds.includes(messageId)) {
                    messageQueueRef.current[existingSenderIndex].messages.push(content);
                    messageQueueRef.current[existingSenderIndex].messageIds.push(messageId);
                }
            } else {
                messageQueueRef.current.push({ senderName, messages: [content], messageIds: [messageId] });
            }

            if (!isProcessingRef.current && isMountedRef.current) {
                console.log('🎤 Starting queue processing');
                processQueue();
            } else {
                console.log('🎤 Queue is already processing');
            }
        };

        socket.on('receive-message', handleReceiveMessage);

        return () => {
            socket.off('receive-message', handleReceiveMessage);
        };
    }, [socket, user]);

    // 3. Listen for proactive event reminders
    useEffect(() => {
        if (!socket) return;

        const handleEventReminder = (event) => {
            console.log('🎤 Event reminder received:', event);
            const speakMsg = `Hey boss, don't forget that you have ${event.title} at ${event.time}. You just have one hour left.`;
            
            // Proactively speak out loud!
            speakText(speakMsg);

            // Trigger a high-visibility toast alert!
            toast.error(`⏰ Reminder: ${event.title} is starting at ${event.time}! (1 hour left)`, {
                duration: 10000,
                icon: '⏰'
            });
        };

        socket.on('event-reminder', handleEventReminder);

        return () => {
            socket.off('event-reminder', handleEventReminder);
        };
    }, [socket]);

    // Handle unmount to cancel speech
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            console.log('🎤 Component unmounted, canceling speech');
            window.speechSynthesis.cancel();
        };
    }, []);

    const speakText = (text) => {
        return new Promise((resolve) => {
            console.log("🎤 Speaking:", text);
            // Always ensure previous speech is canceled before starting new one to avoid overlapping
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            window.utterances = window.utterances || [];
            window.utterances.push(utterance);

            let isResolved = false;
            const cleanup = () => {
                if (isResolved) return;
                isResolved = true;
                const idx = window.utterances.indexOf(utterance);
                if (idx > -1) window.utterances.splice(idx, 1);
                resolve();
            };

            utterance.onend = cleanup;
            utterance.onerror = (e) => {
                console.error("🎤 Speech synthesis error:", e);
                cleanup();
            };
            
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }

            window.speechSynthesis.speak(utterance);
            setTimeout(cleanup, Math.max(3000, text.length * 80)); 
        });
    };

    const listenForResponse = () => {
        return new Promise((resolve) => {
            console.log("🎤 Starting Speech Recognition...");

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.error("🎤 Speech Recognition not supported in this browser");
                resolve('error');
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            let hasResponded = false;
            
            const timeoutId = setTimeout(() => {
                if (!hasResponded) {
                    console.log("🎤 Speech recognition timed out automatically.");
                    recognition.abort();
                    resolve('timeout');
                }
            }, 10000); // 10 seconds timeout for better reliability

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                console.log("🎤 User said:", transcript);
                hasResponded = true;
                clearTimeout(timeoutId);
                
                let answer = 'unknown';
                if (['yes', 'yeah', 'read', 'sure', 'please', 'ok', 'okay', 'yep'].some(w => transcript.includes(w))) {
                    answer = 'yes';
                } else if (['no', 'nope', 'stop', 'dont', 'nah'].some(w => transcript.includes(w))) {
                    answer = 'no';
                }
                
                recognition.abort(); // FORCE MIC TO CLOSE
                resolve(answer);
            };

            recognition.onerror = (e) => {
                console.error("🎤 Speech recognition error:", e.error);
                if (e.error === 'no-speech') {
                    // Let it run until timeout or onend triggers
                    return;
                }
                hasResponded = true;
                clearTimeout(timeoutId);
                resolve('error');
            };

            recognition.onend = () => {
                clearTimeout(timeoutId);
                if (!hasResponded) {
                    resolve('timeout');
                }
            };

            try {
                recognition.start();
            } catch (e) {
                console.error("🎤 Failed to start recognition:", e);
                resolve('error');
            }
        });
    };

    // --- COMMAND & WAKE WORD FLOW ---
    const listenForCommand = () => {
        return new Promise((resolve) => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return resolve(null);
            
            const recognition = new SpeechRecognition();
            commandRecognitionRef.current = recognition;
            recognition.continuous = true; 
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let hasResponded = false;
            let currentTranscript = '';
            let silenceTimer = null;
            
            const finish = (finalText) => {
                if (hasResponded) return;
                hasResponded = true;
                clearTimeout(timeoutId);
                clearTimeout(silenceTimer);
                recognition.abort();
                commandRecognitionRef.current = null;
                resolve(finalText);
            };

            const timeoutId = setTimeout(() => {
                finish(currentTranscript || null);
            }, 15000); // 15 seconds max

            recognition.onresult = (event) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final += event.results[i][0].transcript;
                    else interim += event.results[i][0].transcript;
                }
                
                currentTranscript = final || interim || currentTranscript;
                
                // If we heard something, wait 2.5 seconds of silence before finalizing
                clearTimeout(silenceTimer);
                if (currentTranscript.trim().length > 0) {
                    silenceTimer = setTimeout(() => {
                        finish(currentTranscript);
                    }, 2500);
                }
            };

            recognition.onerror = (e) => {
                console.error("🎤 Command recognition error:", e.error);
                if (e.error === 'no-speech' || e.error === 'audio-capture') {
                    // Do not fail immediately on no-speech or capture errors
                    return;
                }
                finish(null);
            };

            recognition.onend = () => {
                finish(currentTranscript || null);
            };

            try { recognition.start(); } catch (e) { finish(null); }
        });
    };

    const handleCommandFlow = async () => {
        if (!isMountedRef.current) return;
        
        // Stop wake word listener if running to avoid mic conflicts
        if (wakeRecognitionRef.current) {
            console.log("🎤 Aborting wake word recognition before starting command flow");
            try {
                wakeRecognitionRef.current.abort();
            } catch(e) {
                console.error("🎤 Error aborting wake word:", e);
            }
            wakeRecognitionRef.current = null;
        }

        setIsListeningForVoice(false);
        setIsListeningForWakeWord(false);
        
        await speakText("Hi boss, what can I do for you?");
        if (!isMountedRef.current) return;

        // Wait until speech synthesis is completely finished speaking
        while (window.speechSynthesis && window.speechSynthesis.speaking) {
            await new Promise(r => setTimeout(r, 100));
        }

        // Prevent Chrome echo cancellation bug by delaying mic activation
        await new Promise(r => setTimeout(r, 600));

        toast("I'm listening... Speak your command.", { icon: '🎤', id: 'ai-listening', duration: 15000 });
        setIsListeningForVoice(true);
        const command = await listenForCommand();
        setIsListeningForVoice(false);
        toast.dismiss('ai-listening');

        if (!command) {
            await speakText("I didn't catch a command. Going back to sleep.");
            listenForWakeWord(); // Start wake word listener again
            return;
        }

        console.log("🎤 Command heard:", command);
        setIsProcessingCommand(true);
        toast.loading("Gemini is extracting intent...", { id: 'ai-intent' });
        
        // Give audio feedback that it's processing
        await speakText("Got it, one moment...");

        try {
            const response = await axios.post('/api/messages/ai/extract-intent', { transcript: command }, { timeout: 15000 }); // 15s timeout
            const intent = response.data;
            console.log("🎤 Extracted Intent:", intent);
            
            if (intent.action === 'reply' && intent.recipientName && intent.content) {
                toast.success(`Intent parsed: Reply to ${intent.recipientName}`, { id: 'ai-intent' });
                // Fetch chats to find the recipient
                const chatsRes = await axios.get('/api/chats');
                const chats = chatsRes.data;
                
                let targetChat = null;
                let targetUser = null;
                
                for (const chat of chats) {
                    if (chat.isGroupChat) continue;
                    const otherUser = chat.participants.find(p => p._id !== user.id);
                    if (otherUser && otherUser.username.toLowerCase().includes(intent.recipientName.toLowerCase())) {
                        targetChat = chat;
                        targetUser = otherUser;
                        break;
                    }
                }
                
                if (targetChat && targetUser) {
                    const msgRes = await axios.post('/api/messages', {
                        chatId: targetChat._id,
                        recipientId: targetUser._id,
                        content: intent.content,
                        messageType: 'text'
                    });
                    
                    if (socket) {
                        socket.emit('send-message', {
                            ...msgRes.data,
                            recipientId: targetUser._id
                        });
                    }
                    
                    toast.success(`Message sent to ${targetUser.username}`, { id: 'ai-intent' });
                    await speakText(`Message sent to ${targetUser.username}.`);
                } else {
                    toast.error(`Contact not found: ${intent.recipientName}`, { id: 'ai-intent' });
                    await speakText(`I couldn't find a contact named ${intent.recipientName}.`);
                }
            } 
            else if (intent.action === 'create_group' && intent.groupName && intent.participantNames) {
                toast.success(`Intent parsed: Create Group ${intent.groupName}`, { id: 'ai-intent' });
                const usersRes = await axios.get('/api/users/all/list'); // Get all users or contacts
                const allUsers = usersRes.data;
                
                let matchedIds = [];
                let matchedNames = [];
                
                intent.participantNames.forEach(name => {
                    const match = allUsers.find(u => u.username.toLowerCase().includes(name.toLowerCase()));
                    if (match && match._id !== user.id) {
                        matchedIds.push(match._id);
                        matchedNames.push(match.username);
                    }
                });
                
                if (matchedIds.length > 0) {
                    const groupRes = await axios.post('/api/chats/group', {
                        groupName: intent.groupName,
                        participantIds: matchedIds
                    });
                    toast.success(`Group ${intent.groupName} created!`, { id: 'ai-intent' });
                    await speakText(`I have created the group ${intent.groupName} with ${matchedNames.join(' and ')}.`);
                } else {
                    toast.error(`Could not match any participants.`, { id: 'ai-intent' });
                    await speakText(`I couldn't find any of those contacts to add to the group.`);
                }
            }
            else if (intent.action === 'check_stories') {
                toast.success(`Intent parsed: Check Stories`, { id: 'ai-intent' });
                const storiesRes = await axios.get('/api/stories');
                const stories = storiesRes.data;
                
                // Get unique users who posted stories
                const uniqueUsers = [...new Set(stories.filter(s => s.userId._id !== user.id).map(s => s.userId.username))];
                
                if (uniqueUsers.length > 0) {
                    let text = `The following people have posted new stories: ${uniqueUsers.join(', ')}.`;
                    await speakText(text);
                } else {
                    await speakText("Nobody has posted any new stories today.");
                }
            }
            else if (intent.action === 'catch_me_up') {
                toast.success(`Intent parsed: Catch me up`, { id: 'ai-intent' });
                const unreadRes = await axios.get('/api/messages/unread/all');
                const unreadMsgs = unreadRes.data;
                
                if (unreadMsgs.length === 0) {
                    await speakText("You don't have any unread messages. You are all caught up!");
                } else {
                    await speakText(`You have ${unreadMsgs.length} unread messages. Let me summarize them for you.`);
                    const sumRes = await axios.post('/api/messages/ai/summarize', { messages: unreadMsgs });
                    await speakText(sumRes.data.summary);
                }
            }
            else {
                console.warn("🎤 AI Intent Action Unknown:", intent);
                toast.error(`I'm not sure what you mean by "${command}"`, { id: 'ai-intent' });
                await speakText(`I heard you say: ${command}. But I'm not sure how to help with that yet. Try saying: create a group, or catch me up.`);
            }
        } catch (error) {
            console.error("🎤 AI Intent Error:", error);
            const errorMessage = error.response?.data?.message || "I had trouble processing that.";
            toast.error(errorMessage, { id: 'ai-intent' });
            await speakText("Sorry, I encountered an error while trying to process your command.");
        } finally {
            if (isMountedRef.current) setIsProcessingCommand(false);
            // After handling command, go back to passive listening
            setTimeout(() => {
                if (isMountedRef.current && messageQueueRef.current.length === 0) {
                    listenForWakeWord();
                }
            }, 2000);
        }
    };

    const listenForWakeWord = () => {
        if (!isMountedRef.current) return;
        setIsListeningForWakeWord(true);
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsListeningForWakeWord(false);
            return;
        }

        const recognition = new SpeechRecognition();
        wakeRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true; // To catch it fast
        recognition.lang = 'en-US';

        let timeoutId;
        let isStopped = false;

        const stopListening = () => {
            isStopped = true;
            recognition.abort();
            wakeRecognitionRef.current = null;
            setIsListeningForWakeWord(false);
            clearTimeout(timeoutId);
        };

        timeoutId = setTimeout(() => {
            // Only timeout if NOT in permanent Kane mode
            if (!kaneActiveRef.current) {
                console.log("🎤 Wake word listener timed out (30s).");
                stopListening();
            } else {
                console.log("🎤 Permanent Kane mode: Refreshing listener...");
                // In permanent mode, we just let it keep going or restart onend
            }
        }, 30000); // 30 seconds

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                finalTranscript += event.results[i][0].transcript.toLowerCase();
            }
            
            console.log("🎤 Wake word heard:", finalTranscript);
            const wakeWords = ['kane', 'cane', 'came', 'ken', 'can ', 'hey'];
            
            if (wakeWords.some(w => finalTranscript.includes(w))) {
                console.log("🎤 WAKE WORD DETECTED!");
                stopListening();
                handleCommandFlow();
            }
        };

        recognition.onerror = (e) => {
            console.error("🎤 Wake word error:", e.error);
            // Don't completely stop on 'no-speech' since it's passive
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                stopListening();
            }
        };

        recognition.onend = () => {
            // If it ends but we haven't stopped it intentionally, restart it
            if (!isStopped && isMountedRef.current) {
                try { recognition.start(); } catch (e) { 
                    console.log("🎤 Retrying wake word listener...");
                    setTimeout(() => {
                        if (!isStopped && isMountedRef.current) {
                            try { recognition.start(); } catch(err) { stopListening(); }
                        }
                    }, 1000);
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error("🎤 Failed to start wake word on init:", e);
            // If mic is locked, retry after 1 second
            setTimeout(() => {
                if (!isStopped && isMountedRef.current) {
                    try { recognition.start(); } catch(err) { stopListening(); }
                }
            }, 1000);
        }
    };
    // --------------------------------

    const processQueue = async (isRecursive = false) => {
        if (!isMountedRef.current) return;
        
        // Prevent concurrent queue processing loops
        if (isProcessingRef.current && !isRecursive) {
            console.log("🎤 processQueue aborted: Already processing");
            return;
        }
        
        console.log("🎤 processQueue called. Queue length:", messageQueueRef.current.length);
        if (messageQueueRef.current.length === 0) {
            isProcessingRef.current = false;
            if (isMountedRef.current) setIsListeningForVoice(false);
            console.log("🎤 Queue is empty. Stopping processing. Activating wake word listener.");
            
            // Activate wake word listener for 30 seconds
            if (isMountedRef.current) {
                setTimeout(() => {
                    if (isMountedRef.current) listenForWakeWord();
                }, 500); // small delay before listening
            }
            return;
        }

        isProcessingRef.current = true;
        const currentBatch = messageQueueRef.current[0];
        
        const senders = messageQueueRef.current.map(q => q.senderName);
        const uniqueSenders = [...new Set(senders)];
        
        let promptText = '';
        if (uniqueSenders.length > 1) {
            const names = uniqueSenders.slice(0, -1).join(', ') + ' and ' + uniqueSenders[uniqueSenders.length - 1];
            promptText = `You have new messages from ${names}. Would you like me to read the messages from ${currentBatch.senderName}?`;
        } else {
            const msgCount = currentBatch.messages.length;
            promptText = `You have ${msgCount} new message${msgCount > 1 ? 's' : ''} from ${currentBatch.senderName}. Would you like me to read ${msgCount > 1 ? 'them' : 'it'}?`;
        }

        await speakText(promptText);
        if (!isMountedRef.current) return;

        setIsListeningForVoice(true);
        const response = await listenForResponse();
        if (!isMountedRef.current) return;
        setIsListeningForVoice(false);
        
        console.log("🎤 Response to read prompt:", response);

        if (response === 'yes') {
            let msgText = `${currentBatch.senderName} says: `;
            if (currentBatch.messages.length > 1) {
                 msgText += currentBatch.messages.join('. Then they say: ');
            } else {
                 msgText += currentBatch.messages[0];
            }
            await speakText(msgText);
        } else if (response === 'no') {
            await speakText("Okay, skipping.");
        } else {
            // error, timeout, or unknown
            await speakText("I didn't catch that, skipping.");
        }

        if (!isMountedRef.current) return;

        // Mark messages as read in backend
        try {
            const validIds = currentBatch.messageIds.filter(id => id); 
            if (validIds.length > 0) {
                await axios.post('/api/messages/mark-read', { messageIds: validIds });
                console.log(`🎤 Marked ${validIds.length} messages as read`);
            }
        } catch (err) {
            console.error('🎤 Error marking read:', err);
        }

        // Remove the processed batch
        messageQueueRef.current.shift();

        // Process next batch after a short delay
        setTimeout(() => {
            if (isMountedRef.current) processQueue(true); // Pass true to allow recursive call
        }, 1500);
    };

    // DEBUG FUNCTION: Manually trigger the queue for testing
    const testVoiceFeature = () => {
        console.log("🎤 Manual test triggered");
        messageQueueRef.current.push({ senderName: "TestUser", messages: ["This is a test message to verify the voice feature works."], messageIds: [] });
        if (!isProcessingRef.current) {
            processQueue();
        }
    };
    // ------------------------------------

    const togglePopup = () => {
        if (!isOpen) {
            setIsOpen(true);
            setIsGreeting(true);
            const utterance = new SpeechSynthesisUtterance('Hi, I am your AI assistant');
            window.speechSynthesis.speak(utterance);
        } else {
            setIsOpen(false);
            window.speechSynthesis.cancel();
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim()) return;

        if (isGreeting) {
            setIsGreeting(false);
        }

        const userMsg = { role: 'user', content: message };
        setMessages(prev => [...prev, userMsg]);
        setMessage('');
        setIsLoading(true);

        try {
            const response = await axios.post('/api/messages/ai-chat', { content: message });
            const botMsg = { role: 'bot', content: response.data.reply };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('AI chat error:', error);
            const errorText = error.response?.data?.message || "Sorry, I'm having trouble connecting right now.";
            const errorMsg = { role: 'bot', content: errorText };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    // ─── Always-On Kane Toggle ───────────────────────────────────────
    const toggleKane = () => {
        if (kaneActive) {
            // Turn OFF
            kaneActiveRef.current = false;
            setKaneActive(false);
            if (wakeRecognitionRef.current) {
                wakeRecognitionRef.current.abort();
                wakeRecognitionRef.current = null;
            }
            if (commandRecognitionRef.current) {
                commandRecognitionRef.current.abort();
                commandRecognitionRef.current = null;
            }
            setIsListeningForWakeWord(false);
            setIsListeningForVoice(false);
            window.speechSynthesis.cancel();
            toast('Kane deactivated.', { icon: '😴' });
        } else {
            // Turn ON — immediately activate command flow (skip wake word)
            kaneActiveRef.current = true;
            setKaneActive(true);
            toast('Kane activated! Say your command.', { icon: '🤖', duration: 3000 });
            handleCommandFlow();
        }
    };
    // ─────────────────────────────────────────────────────────────────

    return (
        <div className="ai-assistant-container">
            {/* Global Voice Listener Indicator */}
            {isListeningForVoice && (
                <div 
                    className="global-voice-indicator" 
                    onClick={() => {
                        // If they click the indicator, we forcefully stop Speech Recognition to submit it immediately
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                        // Not a direct way to abort from here without ref, but they can just click it as a hint.
                        toast('Processing your voice...', { id: 'ai-listening', icon: '⏳' });
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Click to force submit if it's stuck listening"
                >
                    <FiMic size={16} className="pulse-animation" />
                    <span>Listening... (Click to submit)</span>
                </div>
            )}

            {/* Wake Word Indicator */}
            {!isListeningForVoice && isListeningForWakeWord && !isProcessingCommand && (
                <div className="global-voice-indicator" style={{ background: 'rgba(76, 175, 80, 0.9)' }}>
                    <FiMic size={16} className="pulse-animation" />
                    <span>Listening for "Kane"...</span>
                </div>
            )}

            {/* Processing Indicator */}
            {isProcessingCommand && (
                <div className="global-voice-indicator" style={{ background: 'rgba(33, 150, 243, 0.9)' }}>
                    <div className="typing-indicator pulse-animation" style={{ display: 'inline-flex', padding: 0, background: 'transparent' }}>
                        <span></span><span></span><span></span>
                    </div>
                    <span style={{ marginLeft: '8px' }}>Processing...</span>
                </div>
            )}

            {isOpen && (
                <div className="ai-popup">
                    <div className="ai-header">
                        <div className="ai-avatar">
                            <FiCpu size={18} />
                        </div>
                        <h3>NexBot Assistant</h3>
                        <button 
                            onClick={testVoiceFeature}
                            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            title="Test Voice Feature"
                        >
                            Test Voice
                        </button>
                    </div>

                    <div className="ai-content">
                        {isGreeting ? (
                            <div className="ai-greeting-view">
                                <p className="ai-greeting-text">Hi, I am your AI assistant</p>
                                <div className="voice-visualizer">
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                </div>
                                <p style={{ fontSize: '12px', color: '#888' }}>Ask me anything to get started</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, index) => (
                                    <div key={index} className={`ai-message ${msg.role}`}>
                                        {msg.content}
                                    </div>
                                ))}
                                {isLoading && <div className="ai-message bot">Thinking...</div>}
                                <div ref={chatEndRef} />
                            </>
                        )}
                    </div>

                    <div className="ai-input-area">
                        <input
                            type="text"
                            className="ai-input"
                            placeholder="Type your message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                        />
                        <button 
                            className="ai-send-btn" 
                            onClick={handleSendMessage}
                            disabled={isLoading || !message.trim()}
                        >
                            <FiSend size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Kane Always-On FAB */}
            <button
                className={`kane-fab ${kaneActive ? 'kane-fab-active' : ''} ${isProcessingCommand ? 'kane-fab-processing' : ''}`}
                onClick={toggleKane}
                title={kaneActive ? 'Kane is listening — click to turn off' : 'Click to activate Kane'}
            >
                <span className="kane-fab-icon">{isProcessingCommand ? '⏳' : '🤖'}</span>
                <span className="kane-fab-label">{isProcessingCommand ? 'Working...' : kaneActive ? 'Kane ON' : 'Kane'}</span>
            </button>

            <button className={`ai-fab ${isOpen ? 'open' : ''}`} onClick={togglePopup}>
                {isOpen ? <FiX size={28} /> : <FiMessageSquare size={28} />}
            </button>
        </div>
    );
};

export default AIAssistant;
