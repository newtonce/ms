// +build !js

package main

import "fmt"

type jsonparser map[string]interface{}

type roommgr struct {
	rooms map[string]room
}

// CreateRoomMgr is create a room manager object
func CreateRoomMgr() *roommgr {
	return &roommgr{
		rooms: make(map[string]room),
	}
}

func (rm *roommgr) HandleMessage(msg string) {
	m, err := CreateJSONParser(msg)
	if err != nil {
		fmt.Println("json.Unmarshal failed:", err)
	}
	command := GetValue(m, "type")
	roomid := GetValue(m, "roomid")
	if command == "login" {
		if _, ok := rm.rooms[roomid]; ok {
			delete(rm.rooms, roomid)
		}

		room := CreateRoom(roomid)
		rm.rooms[roomid] = *room
		room.HandleMessage(m)
	} else if command == "logout" {
		if _, ok := rm.rooms[roomid]; ok {
			delete(rm.rooms, roomid)
		}
	} else if command == "push" ||
		command == "stoppush" ||
		command == "sub" ||
		command == "stopsub" ||
		command == "offer" ||
		command == "answer" ||
		command == "candidate" {
		if _, ok := rm.rooms[roomid]; ok {
			r := rm.rooms[roomid]
			r.HandleMessage(m)
		} else {
			fmt.Println("room not created yet:", msg)
		}
	} else {
		fmt.Println("unsupport msg type:", msg)
	}
}