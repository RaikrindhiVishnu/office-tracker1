import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
}

interface MessagesViewProps {
  view: string;
  messages: Message[];
  newMsg: string;
  setNewMsg: (msg: string) => void;
  sendMessage: () => void;
  loadMessages: () => void;
  db: any; // Firestore database instance
}

const MessagesView: React.FC<MessagesViewProps> = ({
  view,
  messages,
  newMsg,
  setNewMsg,
  sendMessage,
  loadMessages,
  db,
}) => {
  if (view !== "messages") return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#193677] flex items-center justify-center text-white shadow-lg">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Broadcast Messages</h2>
            <p className="text-sm text-slate-500">Send announcements to all employees</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-slate-900 placeholder-slate-400"
            placeholder="Type your announcement..."
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim()}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Send Message
          </button>
        </div>

        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="font-medium text-slate-600">No messages yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Create your first broadcast message
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-4 p-4 bg-gradient-to-r from-white to-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                  </svg>
                </div>
                <p className="flex-1 text-slate-700 break-words">{m.text}</p>
                <button
                  onClick={() => {
                    if (confirm("Delete this message?")) {
                      deleteDoc(doc(db, "messages", m.id)).then(() =>
                        loadMessages()
                      );
                    }
                  }}
                  className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg font-medium hover:bg-rose-200 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesView;