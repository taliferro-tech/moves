import { TestBed } from '@angular/core/testing';

import { MissionGoalComponent } from './mission-goal.component';
import { MissionsApiService } from './missions-api.service';
import { MissionView, missionState } from './missions.model';

function mission ( extra: Partial<MissionView> = {} ): MissionView {
  return { id: 'm1', status: 'done', isOwner: true, steps: [], followUps: [], ...extra } as unknown as MissionView;
}

const progress = {
  statement: 'Reach 30 Black-led VC firms and hear back from 3 partners.',
  measures: [{ metric: 'firms_reached', label: 'Firms reached', target: 30, value: 22, met: false }, { metric: 'replied', label: 'Replies', target: 3, value: 3, met: true }],
  met: false,
  line: 'Firms reached 22/30 · Replies 3/3',
} as const;

describe( 'A Mission\'s goal (2026-11-05)', () => {
  it( 'says a finished Mission missed its goal instead of just "Done"', () => {
    expect( missionState( mission( { goalMet: false } ), [], 'u1' ) ).toEqual( { tone: 'stopped', label: 'Finished · goal not met' } );
    expect( missionState( mission( { goalMet: true } ), [], 'u1' ) ).toEqual( { tone: 'done', label: 'Done · goal met' } );
    expect( missionState( mission(), [], 'u1' ) ).toEqual( { tone: 'done', label: 'Done' } );
  } );

  it( 'shows each measure against its target, and lets the owner change targets before it finishes', async () => {
    const saveGoal = jasmine.createSpy( 'saveGoal' ).and.callFake( async ( _id: string, goal: { measures: { metric: string; target: number }[] } ) => mission( { status: 'active' as any, goal: { statement: progress.statement, measures: goal.measures.map( ( m ) => ( { ...m, label: m.metric } ) ) as any } } ) );
    TestBed.configureTestingModule( { imports: [MissionGoalComponent], providers: [{ provide: MissionsApiService, useValue: { saveGoal } }] } );
    const fixture = TestBed.createComponent( MissionGoalComponent );
    fixture.componentRef.setInput( 'mission', mission( { status: 'active' as any, goalProgress: progress as any } ) );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const measures = el.querySelectorAll( '[data-cy="goal-measure"]' );
    expect( measures.length ).toBe( 2 );
    expect( measures[0].textContent ).toContain( '22' );
    expect( measures[0].textContent ).toContain( '/ 30' );
    expect( el.querySelector( '[data-cy="goal-verdict"]' ) ).toBeNull();

    const component = fixture.componentInstance;
    let saved: MissionView | null = null;
    component.saved.subscribe( ( m ) => ( saved = m ) );
    component.startEdit();
    component.draft.update( ( rows ) => rows.map( ( r ) => ( r.metric === 'firms_reached' ? { ...r, target: 40 } : r ) ) );
    await component.save();
    expect( saveGoal ).toHaveBeenCalledWith( 'm1', { measures: [{ metric: 'firms_reached', target: 40 }, { metric: 'replied', target: 3 }] } );
    expect( saved ).not.toBeNull();
  } );

  it( 'marks a finished Mission met or not met, and stops editing', () => {
    TestBed.configureTestingModule( { imports: [MissionGoalComponent], providers: [{ provide: MissionsApiService, useValue: {} }] } );
    const fixture = TestBed.createComponent( MissionGoalComponent );
    fixture.componentRef.setInput( 'mission', mission( { goalMet: false, goalProgress: progress as any } ) );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect( el.querySelector( '[data-cy="goal-verdict"]' )?.textContent ).toContain( 'Not met' );
    expect( el.querySelector( '[data-cy="goal-edit"]' ) ).toBeNull();
  } );
} );
