package main

import (
	"log"
	"net/http"
	"os"

	"clientsidechat/backend/internal/chat"
)

func main() {
	addr := os.Getenv("CHATD_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	svc := chat.NewService(chat.NewRouter(chat.NewMockServerRunner(), chat.NewLoopbackClientBridge()))
	server := chat.NewHTTPServer(svc)

	log.Printf("chatd listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
