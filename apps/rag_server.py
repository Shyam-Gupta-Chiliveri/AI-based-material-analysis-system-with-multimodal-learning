"""Standards desk. Same retrieval and answer as the Streamlit app, HTML in front."""

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq

BASE = Path(__file__).resolve().parent.parent
WEB = Path(__file__).resolve().parent / "standards"
FAISS_DIR = BASE / "faiss_index_local"
PORT = int(os.getenv("PORT", "8080"))

STATE = {"db": None, "error": ""}


def extract_answer(msg):
    content = msg.content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("text"):
                parts.append(block["text"])
        content = "\n".join(parts)
    content = (content or "").strip()
    if not content:
        extra = msg.additional_kwargs or {}
        content = (extra.get("reasoning_content") or extra.get("reasoning") or "").strip()
    return content


def ask(question, top_k):
    db = STATE["db"]
    if db is None:
        return "The knowledge base is still loading.", []
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        return "GROQ_API_KEY is not set on the server. The desk cannot answer until that environment variable is provided.", []

    results = db.similarity_search_with_score(question, k=top_k)
    if not results:
        return "No relevant documents found.", []

    context = "\n\n".join(doc.page_content for doc, _ in results)
    sources = [
        f"{Path(doc.metadata.get('source', '?')).name} (Page {doc.metadata.get('page', 0) + 1})"
        for doc, _ in results
    ]
    prompt = f"""You are a materials science lab instructor. Use the textbook excerpts below to answer the student's question.

Write a clear, practical answer in complete sentences (at least 120 words).
Cover the relevant lab steps if the question is about sample preparation
(sectioning, mounting, grinding, polishing, etching, cleaning, safety).
Use details from the excerpts. If the excerpts are incomplete, still answer
from what they do contain and say what is missing.

Textbook excerpts:
{context}

Student question: {question}

Answer:"""
    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        temperature=0.3,
        groq_api_key=key,
        max_tokens=4096,
        reasoning_format="parsed",
        reasoning_effort="low",
    )
    answer = extract_answer(llm.invoke(prompt))
    if not answer:
        answer = (
            "The knowledge base found relevant textbook pages, but the model "
            "returned an empty answer. Try searching again, or ask a more "
            "specific question such as: 'What are the steps for metallographic "
            "sample preparation: cutting, mounting, grinding, polishing and etching?'"
        )
    return answer, sources


def load_index():
    try:
        embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        if not ((FAISS_DIR / "index.faiss").is_file() and (FAISS_DIR / "index.pkl").is_file()):
            STATE["error"] = "Knowledge base is missing."
            return
        STATE["db"] = FAISS.load_local(
            str(FAISS_DIR), embeddings, allow_dangerous_deserialization=True
        )
    except Exception as exc:
        STATE["error"] = str(exc)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, code, body, content_type):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _file(self, name):
        path = (WEB / name).resolve()
        if not str(path).startswith(str(WEB.resolve())) or not path.is_file():
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        kind = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }.get(path.suffix, "application/octet-stream")
        self._send(200, path.read_bytes(), kind)

    def do_GET(self):
        path = unquote(self.path.split("?", 1)[0])
        if path in ("/health", "/_stcore/health"):
            ready = STATE["db"] is not None
            body = json.dumps({
                "ok": ready,
                "index": ready,
                "key": bool(os.getenv("GROQ_API_KEY", "")),
                "error": STATE["error"],
            })
            self._send(200 if ready else 503, body, "application/json")
            return
        if path in ("/", "/index.html"):
            self._file("index.html")
            return
        if path in ("/styles.css", "/app.js"):
            self._file(path.lstrip("/"))
            return
        self._send(404, "Not found", "text/plain; charset=utf-8")

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/ask":
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(min(length, 20000))
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, json.dumps({"error": "Please enter a question."}), "application/json")
            return
        question = str(payload.get("question") or "").strip()
        if not question:
            self._send(400, json.dumps({"error": "Please enter a question."}), "application/json")
            return
        try:
            top_k = int(payload.get("top_k", 5))
        except (TypeError, ValueError):
            top_k = 5
        top_k = max(1, min(10, top_k))
        started = time.time()
        try:
            answer, sources = ask(question[:2000], top_k)
        except Exception as exc:
            answer, sources = f"Error: {exc}", []
        elapsed = time.time() - started
        body = json.dumps({
            "answer": answer,
            "sources": sources,
            "seconds": round(elapsed, 2),
            "words": len(answer.split()),
        })
        self._send(200, body, "application/json")


if __name__ == "__main__":
    import threading
    threading.Thread(target=load_index, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
