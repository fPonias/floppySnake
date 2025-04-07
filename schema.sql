--
-- PostgreSQL database dump
--

-- Dumped from database version 14.15 (Homebrew)
-- Dumped by pg_dump version 17.0

-- Started on 2025-04-06 18:08:05 PDT

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: codymunger
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO codymunger;

--
-- TOC entry 3609 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: codymunger
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 210 (class 1259 OID 16412)
-- Name: comment; Type: TABLE; Schema: public; Owner: codymunger
--

CREATE TABLE public.comment (
    id integer NOT NULL,
    parent integer,
    name character varying(48),
    posted bigint,
    updated bigint,
    comment character varying(4096),
    ip character varying(15),
    postid bigint
);


ALTER TABLE public.comment OWNER TO codymunger;

--
-- TOC entry 209 (class 1259 OID 16411)
-- Name: comment_id_seq; Type: SEQUENCE; Schema: public; Owner: codymunger
--

CREATE SEQUENCE public.comment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comment_id_seq OWNER TO codymunger;

--
-- TOC entry 3612 (class 0 OID 0)
-- Dependencies: 209
-- Name: comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: codymunger
--

ALTER SEQUENCE public.comment_id_seq OWNED BY public.comment.id;


--
-- TOC entry 212 (class 1259 OID 16448)
-- Name: post_id_seq; Type: SEQUENCE; Schema: public; Owner: codymunger
--

CREATE SEQUENCE public.post_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_id_seq OWNER TO codymunger;

--
-- TOC entry 211 (class 1259 OID 16440)
-- Name: post; Type: TABLE; Schema: public; Owner: codymunger
--

CREATE TABLE public.post (
    id bigint DEFAULT nextval('public.post_id_seq'::regclass) NOT NULL,
    url character varying(2048) NOT NULL
);


ALTER TABLE public.post OWNER TO codymunger;

--
-- TOC entry 3457 (class 2604 OID 16415)
-- Name: comment id; Type: DEFAULT; Schema: public; Owner: codymunger
--

ALTER TABLE ONLY public.comment ALTER COLUMN id SET DEFAULT nextval('public.comment_id_seq'::regclass);


--
-- TOC entry 3460 (class 2606 OID 16419)
-- Name: comment comment_pkey; Type: CONSTRAINT; Schema: public; Owner: codymunger
--

ALTER TABLE ONLY public.comment
    ADD CONSTRAINT comment_pkey PRIMARY KEY (id);


--
-- TOC entry 3464 (class 2606 OID 16446)
-- Name: post post_pkey; Type: CONSTRAINT; Schema: public; Owner: codymunger
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (id);


--
-- TOC entry 3461 (class 1259 OID 16425)
-- Name: fki_parentFK; Type: INDEX; Schema: public; Owner: codymunger
--

CREATE INDEX "fki_parentFK" ON public.comment USING btree (parent);


--
-- TOC entry 3462 (class 1259 OID 16447)
-- Name: fki_postFK; Type: INDEX; Schema: public; Owner: codymunger
--

CREATE INDEX "fki_postFK" ON public.comment USING btree (postid DESC) WITH (deduplicate_items='true');


--
-- TOC entry 3610 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: codymunger
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO floppysnake;


--
-- TOC entry 3611 (class 0 OID 0)
-- Dependencies: 210
-- Name: TABLE comment; Type: ACL; Schema: public; Owner: codymunger
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.comment TO floppysnake;


--
-- TOC entry 3613 (class 0 OID 0)
-- Dependencies: 209
-- Name: SEQUENCE comment_id_seq; Type: ACL; Schema: public; Owner: codymunger
--

GRANT ALL ON SEQUENCE public.comment_id_seq TO floppysnake;


--
-- TOC entry 3614 (class 0 OID 0)
-- Dependencies: 212
-- Name: SEQUENCE post_id_seq; Type: ACL; Schema: public; Owner: codymunger
--

GRANT ALL ON SEQUENCE public.post_id_seq TO floppysnake;


--
-- TOC entry 3615 (class 0 OID 0)
-- Dependencies: 211
-- Name: TABLE post; Type: ACL; Schema: public; Owner: codymunger
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.post TO floppysnake;


-- Completed on 2025-04-06 18:08:05 PDT

--
-- PostgreSQL database dump complete
--

