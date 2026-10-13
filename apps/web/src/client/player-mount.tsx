'use client';

import { useEffect, useRef } from 'react';
import type { Course } from '@gamatutor/course-schema';
import { createPlayer, type PlayerState } from '@gamatutor/course-player';
import { PlatformAdapter } from './platform-adapter';

export interface PlayerMountProps {
  course: Course;
  courseTitle: string;
  attemptId: string;
  learnerName: string;
  assetBase: string;
  resume: Partial<PlayerState> | null;
}

/**
 * The same shell the standalone package uses, owned by the player once
 * mounted: React renders it once and never touches it again.
 */
export function PlayerMount(props: PlayerMountProps) {
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = appRef.current;
    if (!mount) return;
    const adapter = new PlatformAdapter(props.attemptId, props.learnerName, props.course.id);
    const player = createPlayer({
      mount,
      course: props.course,
      adapter,
      assetBase: props.assetBase,
      ...(props.resume ? { initialState: props.resume } : {}),
    });
    void adapter.init();
    player.render(); // emits 'launched' on first render
    return () => {
      player.destroy();
      adapter.dispose();
    };
    // Mount once per page; props come from the server and do not change.
  }, []);

  return (
    <div className="app" ref={appRef}>
      <div className="sidebar">
        <div className="sidebar-head">
          <div className="top-icons">
            <a className="top-link" href="/kursus" aria-label="Kembali ke daftar kursus">
              &laquo; Semua Kursus
            </a>
            <a className="top-link" href="/profil" aria-label="Profil peserta">
              {props.learnerName}
            </a>
          </div>
          <div className="brand">
            <div className="brand-mark">{props.course.brand.mark}</div>
          </div>
          <div className="course-title">{props.courseTitle}</div>
        </div>
        <ul className="steps" id="stepList"></ul>
      </div>
      <div className="main">
        <div className="content-card" id="contentCard"></div>
      </div>
    </div>
  );
}
