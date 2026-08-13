# Initial database ER diagram

```mermaid
erDiagram
    DOCUMENTS {
        bigint id PK
        text source
        text title
        text version
        text content
        boolean is_active
        timestamptz created_at
    }

    DOCUMENT_CHUNKS {
        bigint id PK
        bigint document_id FK
        integer chunk_index
        text content
        vector embedding
        jsonb metadata
        timestamptz created_at
    }

    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : contains
```

`DOCUMENTS` stores the original source. `DOCUMENT_CHUNKS` stores the smaller pieces used for semantic search. Each chunk has its own embedding because the RAG query retrieves relevant chunks, not entire documents.
