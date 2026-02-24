"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface Props {
  roomName: string;
  displayName: string;
  onClose: () => void;
}

export default function JitsiCall({
  roomName,
  displayName,
  onClose,
}: Props) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.JitsiMeetExternalAPI) return;

    const domain = "meet.jit.si";

    const options = {
      roomName,
      width: "100%",
      height: "100%",
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName,
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
      },
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);

    return () => {
      api.dispose();
    };
  }, [roomName, displayName]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        <h2 className="font-semibold">Video Call</h2>
        <button
          onClick={onClose}
          className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
        >
          End Call
        </button>
      </div>

      <div ref={jitsiContainerRef} className="flex-1" />
    </div>
  );
}