/* eslint-disable no-extend-native */

// const mqtt_moudle=document.createElement('script');
// mqtt_moudle.setAttribute('type', 'text/javascript');
// mqtt_moudle.setAttribute('src', 'js/mqttprocesser.js');
// document.body.appendChild(mqtt_moudle);

let audio_input_device_;
let video_input_device_;
let audio_output_device_;
let mqtt_connected_ = false; //  mqtt connect status
let joined_room_ = false; //  join room status
const usermap_ = new Map(); //  users set
const publish_map_ = new Map(); //  publish streams set
const subscribe_map_ = new Map(); //  subscribe streams set
let usercallback;

Array.prototype.indexOf = function(val) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] == val) {
      return i;
    }
  }
  return -1;
};
Array.prototype.remove = function(val) {
  const index = this.indexOf(val);
  if (index > -1) {
    this.splice(index, 1);
  }
};

//  for notify UI event
function set_user_event_callback(eCallback) {
  if (typeof eCallback === 'function') {
    // eslint-disable-next-line no-unused-vars
    usercallback = eCallback;
  }
}

function device_discovery() {
  if (!navigator.mediaDevices && !navigator.mediaDevices.enumerateDevices) {
    console.log('The browser is not surpport enum media device');
  } else {
    navigator.mediaDevices.addEventListener('devicechange', deviceChange);
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumError);
  }
}

function gotDevices(deviceInfos) {
  for (const info of deviceInfos) {
    const event = {
      id: 'device',
      info: info
    };
    usercallback(event);
  }
}

function enumError(e) {
  console.log('error:'+e);
}

function deviceChange(e) {
  const event = {
    id: 'device-change',
    info: ''
  };
  usercallback(event);
}

function set_audio_input_device(devid) {
  audio_input_device_ = devid;
}

function set_video_input_device(devid) {
  video_input_device_ = devid;
}

function set_audio_output_device(devid) {
  audio_output_device_ = devid;
}

clientid_ = generateUUID();
// clientid_ = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
mqtt_init(clientid_, mqttEventCallback);

//  join the room of media server
async function join_room() {
  if (mqtt_connected_) {
    join2ms();
  } else {
    console.log('not connect to mqtt, please try join room later...');
  }
}

//  leave the room of media server
async function leave_room() {
  if (mqtt_connected_) {
    //  leave room
    joined_room_ = false;
  } else {
    console.log('not connect to mqtt, please try leave room later...');
  }
}

//  publish stream
async function publish_local_stream(streamid, videolable) {
  if (mqtt_connected_ && joined_room_) {
    if (publish_map_.has(clientid_+'_'+streamid)) {
      console.log(streamid+' stream has been published and would be republished now');
      stopPublish(streamid);
    }
    const node={
      sid: streamid,
      peer_conn: null,
      video_wnd: videolable
    };
    publish_map_.set(clientid_+'_'+streamid, node);
    authPush(streamid);
  } else {
    console.log('not connect to mqtt or not join, please try publish stream later...');
  }
}

//  unpublish stream
async function unpublish_local_stream(streamid) {
  if (mqtt_connected_ && joined_room_) {
    stopPublish(streamid);
  } else {
    console.log('not connect to mqtt, please try unpublish stream later...');
  }
}

//  publish stream
async function publish_screenshare(streamid, videolable) {
  if (publish_map_.has(clientid_+'_'+streamid)) {
    console.log(streamid+' stream has been published and would be republished now');
    stopPublish(streamid);
  }
  if (mqtt_connected_ && joined_room_) {
    const node={
      sid: streamid,
      peer_conn: null,
      video_wnd: videolable
    };
    publish_map_.set(clientid_+'_'+streamid, node);
    authPush(streamid);
  } else {
    console.log('not connect to mqtt, please try publish stream later...');
  }
}

//  unpublish stream
async function unpublish_screenshare(streamid) {
  if (mqtt_connected_ && joined_room_) {
    stopPublish(streamid);
  } else {
    console.log('not connect to mqtt, please try unpublish stream later...');
  }
}

//  subscribe audio stream
async function subscribe_remote_stream(userid, streamid, videolable) {
  if (mqtt_connected_ && joined_room_) {
    for (const [key, value] of usermap_) {
      if (key!=clientid_) {
        for (let i =0; i < value.length; i++) {
          if (value[i]===streamid) {
            subscribe(key, value[i], videolable);
            break;
          }
        }
        return;
      }
    }
  } else {
    console.log('not connect to mqtt, please try subscribe stream later...');
  }
}

//  unsubscribe audio stream
async function unsubscribe_remote_stream(streamid) {
  if (mqtt_connected_ && joined_room_) {
    if (mqtt_connected_ && joined_room_) {
      for (const [key, value] of usermap_) {
        if (key!=clientid_) {
          for (let i =0; i < value.length; i++) {
            if (value[i]===streamid) {
              stopPull(key, value[i]);
              break;
            }
          }
          return;
        }
      }
    }
  } else {
    console.log('not connect to mqtt, please try unsubscribe stream later...');
  }
}

async function swap_position(videolable1, videolable2) {
  let swap1=null;
  let swap2=null;
  for ([key, value] of publish_map_) {
    if (value.video_wnd == videolable1) {
      swap1 = value;
    }
    if (value.video_wnd == videolable2) {
      swap2 = value;
    }
  }
  for ([key, value] of subscribe_map_) {
    if (value.video_wnd == videolable1) {
      swap1 = value;
    }
    if (value.video_wnd == videolable2) {
      swap2 = value;
    }
  }
  if (swap1!=null && swap2!=null) {
    const tmp = swap1.video_wnd;
    swap1.video_wnd = swap2.video_wnd;
    swap2.video_wnd = tmp;
  }
}

async function mqttEventCallback(event) {
  if (event.type=='mqtt_connected') {
    mqtt_connected_ = true;
  } else if (event.type=='mqtt_disconnected') {
    mqtt_connected_ = false;
    //  TODO:do something
  } else if (event.type=='join_succeed') {
    joined_room_ = true;
  } else if (event.type=='join_failed') {
    joined_room_ = false;
  } else if (event.type=='pub') {
    handlePub(event.info);
  } else if (event.type=='unpub') {
    handleUnpub(event.info);
  } else if (event.type=='push_succeed') {
    for ([key, value] of publish_map_) {
      if (value.peer_conn==null) {
        startPublishOffer(event.info, value.sid);
      }
    }
  } else if (event.type=='push_failed') {
    //  TODO:
  } else if (event.type=='answer_succeed') {
    publishAnswerHandler(event.info);
  } else if (event.type=='recv_offer') {
    //  sub response
    subOfferHandler(event.info);
  } else {
    console.log("unknow event type:%s",event.type);
  }
}

function getScreenShareConstraints() {
  const videoConstraints = {};
  videoConstraints.aspectRatio = '1.77';//  1.77 means 16:9
  videoConstraints.frameRate = '15'; // 15 frames/sec
  videoConstraints.cursor = 'always'; //  never motion
  videoConstraints.displaySurface = 'monitor';//  monitor window application browser
  videoConstraints.logicalSurface = true;
  // videoConstraints.width = screen.width;
  // videoConstraints.height = screen.height;
  videoConstraints.width = 640;
  videoConstraints.height = 480;

  if (!Object.keys(videoConstraints).length) {
    videoConstraints = true;
  }

  const displayMediaStreamConstraints = {
    video: videoConstraints,
  };
  return displayMediaStreamConstraints;
}

async function startPublishOffer(msg, streamid) {
  let stream;
  let peerOpt;
  
  try {
    if (streamid=='window') {
      const opt = getScreenShareConstraints();
      stream = await navigator.mediaDevices.getDisplayMedia(opt);
      //  peerOpt = {sdpSemantics: 'plan-b'};
      peerOpt = {sdpSemantics: 'unified-plan'};
    } else {
      const media_option = {
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          deviceId: audio_input_device_
        },
        video: {
          width: 640,
          height: 480,
          frameRate: 15,
          deviceId: video_input_device_
        }
      };
      stream = await navigator.mediaDevices.getUserMedia(media_option);// {audio: true, video: true}
      peerOpt = {sdpSemantics: 'unified-plan'};
    }
  } catch (e) {
    publish_map_.delete(clientid_+'_'+streamid);
    alert(`getUserMedia() error: ${e.name}`);
  }
  
  const key = msg.sessionid+'_'+streamid;
  if (publish_map_.has(key)) {
    publish_map_.get(key).video_wnd.srcObject = stream;
  } else {
    console.log("startPublishOffer return");
    return;
  }

  startTime = window.performance.now();
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  peer = new RTCPeerConnection(peerOpt);
  const sem = peer.getConfiguration().sdpSemantics;
  console.log('push peer semantics:'+sem);
  if (publish_map_.has(key)) {
    publish_map_.get(key).peer_conn = peer;
  } else {
    return;
  }

  console.log('Created publish peerconnection: %s', msg.fid+'_'+streamid);
  peer.addEventListener('icecandidate', e => onIceCandidate(peer, e));
  peer.addEventListener('iceconnectionstatechange', e => onIceStateChange(peer, e));

  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  try {
    const offer_sdp = await peer.createOffer({offerToReceiveAudio: 1, offerToReceiveVideo: 1});
    peer.setLocalDescription(offer_sdp);
    offer(streamid, offer_sdp.sdp);
  } catch (e) {
    console.log('Failed to create sdp: ${e.toString()}');
  }
}

async function publishAnswerHandler(msg) {
  const answer_sdp = {
    sdp: msg.sdp,
    type: 'answer'
  };

  try {
    const key = msg.sessionid+'_'+msg.streamid;
    const peer = publish_map_.get(key).peer_conn;
    peer.setRemoteDescription(answer_sdp);
    const candi = new RTCIceCandidate(msg.sdp);
    await peer.addIceCandidate(candi);
  } catch (e) {
    console.log(`add Ice Candidate failed: ${e.toString()}`);
  }
}

function handlePub(msg) {
  if (!usermap_.has(msg.fid)) {
    const list = [];
    list.push(msg.streamid);
    usermap_.set(msg.fid, list);
  } else {
    usermap_.get(msg.fid).push(msg.streamid);
  }
}

function handleUnpub(msg) {
  if (usermap_.has(msg.fid)) {
    usermap_.get(msg.fid).remove(msg.streamid);
  }
}

function subscribe(userid, streamid, videolable) {
  if (publish_map_.has(userid+'_'+streamid)) {
    console.log(streamid+' stream has been subscribed and would be resubscribed now');
    stopPull(key, streamid);
  }
  peer = new RTCPeerConnection({sdpSemantics: 'unified-plan'}); // {sdpSemantics: "unified-plan"}
  const sem = peer.getConfiguration().sdpSemantics;
  console.log('pull peer semantics:'+sem);
  const node={
    peer_conn: null,
    video_wnd: videolable
  };
  node.peer_conn = peer;
  subscribe_map_.set(userid+'_'+streamid, node);
  peer.addEventListener('icecandidate', e => onIceCandidate(peer, e));
  peer.addEventListener('iceconnectionstatechange', e => onIceStateChange(peer, e));
  peer.addEventListener('track', e => gotRemoteStream(userid, streamid, e));
  sub(userid, streamid);
}

async function subOfferHandler(msg) {
  const offer_sdp = {
    sdp: msg.sdp,
    type: 'offer'
  };
  const key = msg.fid+'_'+msg.streamid;
  const peer = subscribe_map_.get(key).peer_conn;
  peer.setRemoteDescription(offer_sdp);
  stopPullButton.disabled = false;
  try {
    const answerOptions = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1
    };
    const answersdp = await peer.createAnswer(answerOptions);
    peer.setLocalDescription(answersdp);
    answer(clientid_, msg.fid, msg.streamid, answersdp.sdp);
    const candi = new RTCIceCandidate(msg.sdp);
    await peer.addIceCandidate(candi);
  } catch (e) {
    console.log(`Failed to create sdp: ${e.toString()}`);
  }
}

function gotRemoteStream(userid, streamid, e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    subscribe_map_.get(userid+'_'+streamid).video_wnd.srcObject = e.streams[0];
    console.log('%s_%s received remote stream', userid, streamid);
  }
}

async function onIceCandidate(peer, event) {
  try {
    if (event.candidate != null) {
      await peer.addIceCandidate(event.candidate);
    }
  } catch (e) {
    console.log(`add Ice Candidate failed: ${e.toString()}`);
  }
  console.log(`ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onIceStateChange(peer, event) {
  if (peer) {
    console.log(` ICE state: ${peer.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function stopPublish(streamid) {
  const key = clientid_+'_'+streamid;
  const peer = publish_map_.get(key).peer_conn;
  //  peer.stream.getTracks().forEach(track => track.stop());
  publish_map_.get(key).video_wnd.srcObject = null;
  peer.close();
  publish_map_.get(key).peer_conn = null;
  publish_map_.delete(key);
  unpush(streamid);
}

function stopPull(userid, streamid) {
  const key = userid+'_'+streamid;
  const peer = subscribe_map_.get(key).peer_conn;
  //  peer.stream.getTracks().forEach(track => track.stop());
  subscribe_map_.get(key).video_wnd.srcObject = null;
  peer.close();
  subscribe_map_.get(key).peer_conn = null;
  subscribe_map_.delete(key);
  unsub(userid, streamid);
}
