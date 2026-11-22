import { Component, computed, Directive, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { FlowStore } from '../../flow/flow.store';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MissionDetailComponent } from '../../shared/missions/mission-detail.component';
import { MissionsCockpitComponent } from '../../shared/missions/missions-cockpit.component';
import { MissionsListComponent } from '../../shared/missions/missions-list.component';
import { Person, Playbook } from '../../shared/missions/missions.model';
import { PlanReplyComponent } from '../../shared/missions/plan-reply.component';
import { PlaybooksComponent } from '../../shared/missions/playbooks.component';

/**
 * Missions in Moves (design_handoff_todd_missions 2a, 5a, 9a). A started
 * Mission is a Move; these pages show its plan, who holds each step, and the
 * report. The screens themselves are shared (taliferro-ui/missions); this
 * file supplies who's signed in and the team's names.
 */
@Directive()
abstract class MissionsPage implements OnInit {
  protected readonly auth = inject( MovesAuthService );
  protected readonly store = inject( FlowStore );
  readonly signedIn = signal<boolean | null>( null );
  readonly viewerId = signal( '' );
  /** Signing in comes back to this page (this Mission), not Moves' home. */
  readonly signInParams = { returnUrl: inject( Router ).url };

  /** Teammates by id, from the flow map's team (not the sample team). */
  readonly people = computed<Record<string, Person>>( () => {
    if ( this.store.mode() !== 'live' ) return {};
    return Object.fromEntries( this.store.state().people.filter( ( p ) => p.kind === 'person' ).map( ( p ) => [p.id, { id: p.id, name: p.name }] ) );
  } );

  ngOnInit (): void {
    this.auth.isLoggedIn().subscribe( ( yes ) => {
      this.signedIn.set( yes );
      if ( yes ) {
        this.viewerId.set( this.auth.getCurrentUserIdSync() );
        this.store.start();
      }
    } );
  }
}

const SHELL_STYLES = `
  :host { display: block; min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font); }
  .page { max-width: 1280px; margin: 0 auto; padding: 28px 36px 64px; }
  .top { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; font-size: 14px; font-weight: 700; }
  .top a { color: var(--text); text-decoration: none; }
  .top .muted { color: var(--muted); }
  .spacer { flex: 1; }
  .signin { background: var(--surface); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .btn.small { height: 36px; padding: 0 16px; color: #fff; }
  .btn { height: 44px; padding: 0 22px; border-radius: 999px; background: var(--blue); color: #fff; font-weight: 700; display: inline-flex; align-items: center; text-decoration: none; }
  @media (max-width: 640px) { .page { padding: 20px 16px 48px; } }
`;

const SIGN_IN = `
  <div class="signin" data-cy="missions-signin">
    <b>Sign in to see your Missions.</b>
    <a class="btn" routerLink="/login" [queryParams]="signInParams">Sign in</a>
  </div>
`;

@Component( {
  selector: 'mv-missions-page',
  standalone: true,
  imports: [MissionsListComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/app">Moves</a><span class="muted">/ Missions</span><span class="spacer"></span><a routerLink="/playbooks" data-cy="to-playbooks">Playbooks</a><a routerLink="/missions/cockpit" data-cy="to-cockpit">Cockpit</a><a class="btn small" routerLink="/missions/new" data-cy="to-new-mission">New Mission</a></nav>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) { <tm-missions-list [viewerId]="viewerId()" [people]="people()" detailBase="/missions/" [initialFilter]="filter()" /> }
    </div>
  `,
  styles: [SHELL_STYLES],
} )
export class MissionsPageComponent extends MissionsPage {
  private readonly route = inject( ActivatedRoute );
  readonly filter = toSignal( this.route.queryParamMap.pipe( map( ( q ) => ( q.get( 'filter' ) as 'all' | 'mine' | 'others' ) || 'all' ) ), { initialValue: 'all' as const } );
}

@Component( {
  selector: 'mv-missions-cockpit-page',
  standalone: true,
  imports: [MissionsCockpitComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/app">Moves</a><span class="muted">/</span><a routerLink="/missions">Missions</a><span class="muted">/ Cockpit</span></nav>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) { <tm-missions-cockpit (picked)="open($event)" /> }
    </div>
  `,
  styles: [SHELL_STYLES],
} )
export class MissionsCockpitPageComponent extends MissionsPage {
  private readonly router = inject( Router );

  /** A dial opens the Missions in that state (design open question 9: assumed). */
  open ( dial: 'stuck' | 'inFlight' | 'waitingOnPeople' | 'waitingOnWorld' ): void {
    void this.router.navigate( ['/missions'], { queryParams: { filter: dial === 'waitingOnPeople' ? 'others' : 'all' } } );
  }
}

@Component( {
  selector: 'mv-mission-page',
  standalone: true,
  imports: [MissionDetailComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/app">Moves</a><span class="muted">/</span><a routerLink="/missions">Missions</a></nav>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn() && missionId()) { <tm-mission-detail [missionId]="missionId()!" [viewerId]="viewerId()" [people]="people()" /> }
    </div>
  `,
  styles: [SHELL_STYLES],
} )
export class MissionPageComponent extends MissionsPage {
  private readonly route = inject( ActivatedRoute );
  readonly missionId = toSignal( this.route.paramMap.pipe( map( ( p ) => p.get( 'id' ) ) ), { initialValue: null } );
}

/**
 * "What do you need done?": ask, get a plan, start it. Lifted from the General
 * Assistant (2026-11-22), which is free and hands every request that needs
 * work here with ?q= (and ?playbook=) filled in. The plan reply waits for the
 * person to start it; nothing runs on arrival.
 */
@Component( {
  selector: 'mv-new-mission-page',
  standalone: true,
  imports: [PlanReplyComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/app">Moves</a><span class="muted">/</span><a routerLink="/missions">Missions</a><span class="muted">/ New</span><span class="spacer"></span><a routerLink="/playbooks" data-cy="to-playbooks">Playbooks</a></nav>
      <h1>What do you need done?</h1>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) {
        <tm-plan-reply [request]="q()" [origin]="playbook() ? 'playbook' : 'ask'" [playbookId]="playbook()" [viewerId]="viewerId()" [people]="people()" detailBase="/missions/" />
      }
    </div>
  `,
  styles: [SHELL_STYLES + ' h1 { margin: 0 0 18px; font-size: 32px; letter-spacing: -.02em; }'],
} )
export class NewMissionPageComponent extends MissionsPage {
  private readonly route = inject( ActivatedRoute );
  readonly q = toSignal( this.route.queryParamMap.pipe( map( ( p ) => p.get( 'q' ) || '' ) ), { initialValue: '' } );
  readonly playbook = toSignal( this.route.queryParamMap.pipe( map( ( p ) => p.get( 'playbook' ) || '' ) ), { initialValue: '' } );
}

/** Playbooks, lifted from the General Assistant (2026-11-22): picking one opens New Mission with it. */
@Component( {
  selector: 'mv-playbooks-page',
  standalone: true,
  imports: [PlaybooksComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/app">Moves</a><span class="muted">/</span><a routerLink="/missions">Missions</a><span class="muted">/ Playbooks</span><span class="spacer"></span><a routerLink="/missions/new">Ask for something else</a></nav>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) { <tm-playbooks [viewerId]="viewerId()" (use)="use($event)" /> }
    </div>
  `,
  styles: [SHELL_STYLES],
} )
export class PlaybooksPageComponent extends MissionsPage {
  private readonly router = inject( Router );

  use ( playbook: Playbook ): void {
    void this.router.navigate( ['/missions/new'], { queryParams: { q: playbook.request, playbook: playbook.id } } );
  }
}
