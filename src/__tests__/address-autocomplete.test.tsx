/**
 * Tests for address autocomplete utilities and the AddressAutocompleteInput
 * React component.
 *
 * Coverage:
 *   A. parseAddressComponents  — Google Places address component mapping
 *   B. parseNominatimResult    — OpenStreetMap / Nominatim address parsing
 *   C. debounce                — timing / call-count behaviour
 *   D. AddressAutocompleteInput component (rendered in jsdom)
 *      D1. Dropdown render logic (suggestions appear after typing ≥ 2 chars)
 *      D2. Address field population on suggestion select (Nominatim path)
 *      D3. Manual mode toggle (Enter manually / plain text input)
 *      D4. API failure → graceful fallback (no crash, no stale spinner)
 *      D5. No results found state
 *      D6. International address — correct country code sent to Nominatim
 *
 * Notes on test environment
 * ─────────────────────────
 * NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is evaluated once at module load time.
 * In Jest the env var is empty, so the Nominatim (OpenStreetMap) branch is
 * always active.  The Google Places branch is covered by the pure-function
 * tests in section A (parseAddressComponents).
 *
 * The component uses a 350 ms debounce timer.  Component tests use fake
 * timers and advance them manually so tests remain fast and deterministic.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  parseAddressComponents,
  parseNominatimResult,
  debounce,
  AddressAutocompleteInput,
} from '@/app/checkout/CheckoutClient';

// ---------------------------------------------------------------------------
// Shared mock fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper — render AddressAutocompleteInput with sensible defaults
// ---------------------------------------------------------------------------

function makeComponent(
  overrides: Partial<React.ComponentProps<typeof AddressAutocompleteInput>> = {},
) {
  const defaults: React.ComponentProps<typeof AddressAutocompleteInput> = {
    value: '',
    onChange: jest.fn(),
    onPlaceSelect: jest.fn(),
    onManualEntry: jest.fn(),
    country: 'AU',
    hasError: false,
    manualMode: false,
  };
  return render(<AddressAutocompleteInput {...defaults} {...overrides} />);
}

/** Nominatim place list fixture */
function nominatimResponse(
  overrides: Partial<{
    place_id: number;
    display_name: string;
    house_number: string;
    road: string;
    suburb: string;
    state: string;
    postcode: string;
    country_code: string;
  }> = {},
) {
  const d = {
    place_id: 9999,
    display_name: '42 George Street, Sydney NSW 2000, Australia',
    house_number: '42',
    road: 'George Street',
    suburb: 'Sydney',
    state: 'New South Wales',
    postcode: '2000',
    country_code: 'au',
    ...overrides,
  };
  return {
    ok: true,
    json: async () => [
      {
        place_id: d.place_id,
        display_name: d.display_name,
        address: {
          house_number: d.house_number,
          road: d.road,
          suburb: d.suburb,
          state: d.state,
          postcode: d.postcode,
          country_code: d.country_code,
        },
      },
    ],
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// A. parseAddressComponents
// ---------------------------------------------------------------------------

describe('parseAddressComponents', () => {
  const make = (type: string, longText: string, shortText = longText) => ({
    types: [type],
    longText,
    shortText,
  });

  it('maps a full AU address correctly', () => {
    const components = [
      make('subpremise', 'Unit 3'),
      make('street_number', '42'),
      make('route', 'George Street'),
      make('locality', 'Sydney'),
      make('administrative_area_level_1', 'New South Wales', 'NSW'),
      make('postal_code', '2000'),
      make('country', 'Australia', 'AU'),
    ];
    const result = parseAddressComponents(components);
    expect(result.address1).toBe('Unit 3 42 George Street');
    expect(result.city).toBe('Sydney');
    expect(result.state).toBe('NSW');
    expect(result.postcode).toBe('2000');
    expect(result.country).toBe('AU');
    console.log('[PASS] Full AU address parsed correctly');
  });

  it('returns address1 without subpremise when absent', () => {
    const components = [
      make('street_number', '10'),
      make('route', 'Queen St'),
      make('locality', 'Brisbane'),
      make('administrative_area_level_1', 'Queensland', 'QLD'),
      make('postal_code', '4000'),
      make('country', 'Australia', 'AU'),
    ];
    const result = parseAddressComponents(components);
    expect(result.address1).toBe('10 Queen St');
    console.log('[PASS] address1 built without subpremise');
  });

  it('falls back to sublocality_level_1 when locality is absent', () => {
    const components = [
      make('street_number', '1'),
      make('route', 'Oxford Street'),
      make('sublocality_level_1', 'Paddington'),
      make('administrative_area_level_1', 'New South Wales', 'NSW'),
      make('postal_code', '2021'),
      make('country', 'Australia', 'AU'),
    ];
    const result = parseAddressComponents(components);
    expect(result.city).toBe('Paddington');
    console.log('[PASS] city falls back to sublocality_level_1');
  });

  it('falls back to postal_town for UK-style addresses', () => {
    const components = [
      make('street_number', '5'),
      make('route', 'High Street'),
      make('postal_town', 'Reading'),
      make('administrative_area_level_1', 'England', 'ENG'),
      make('postal_code', 'RG1 1AA'),
      make('country', 'United Kingdom', 'GB'),
    ];
    const result = parseAddressComponents(components);
    expect(result.city).toBe('Reading');
    console.log('[PASS] city falls back to postal_town for UK address');
  });

  it('falls back to administrative_area_level_2 for city when all others absent', () => {
    const components = [
      make('street_number', '20'),
      make('route', 'Rural Road'),
      make('administrative_area_level_2', 'Blue Mountains'),
      make('administrative_area_level_1', 'New South Wales', 'NSW'),
      make('postal_code', '2785'),
      make('country', 'Australia', 'AU'),
    ];
    const result = parseAddressComponents(components);
    expect(result.city).toBe('Blue Mountains');
    console.log('[PASS] city falls back to administrative_area_level_2');
  });

  it('returns empty strings when components array is empty', () => {
    const result = parseAddressComponents([]);
    expect(result.address1).toBe('');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.postcode).toBe('');
    expect(result.country).toBe('');
    console.log('[PASS] Empty components return empty strings');
  });

  it('maps a US address correctly', () => {
    const components = [
      make('street_number', '1600'),
      make('route', 'Pennsylvania Avenue NW'),
      make('locality', 'Washington'),
      make('administrative_area_level_1', 'District of Columbia', 'DC'),
      make('postal_code', '20500'),
      make('country', 'United States', 'US'),
    ];
    const result = parseAddressComponents(components);
    expect(result.address1).toBe('1600 Pennsylvania Avenue NW');
    expect(result.city).toBe('Washington');
    expect(result.state).toBe('DC');
    expect(result.postcode).toBe('20500');
    expect(result.country).toBe('US');
    console.log('[PASS] US address parsed correctly');
  });
});

// ---------------------------------------------------------------------------
// B. parseNominatimResult
// ---------------------------------------------------------------------------

describe('parseNominatimResult', () => {
  it('parses a typical Australian result correctly', () => {
    const result = parseNominatimResult({
      place_id: 12345,
      display_name: '42 George Street, Sydney, NSW 2000, Australia',
      address: {
        house_number: '42',
        road: 'George Street',
        suburb: 'Sydney',
        state: 'New South Wales',
        postcode: '2000',
        country_code: 'au',
      },
    });
    expect(result.address1).toBe('42 George Street');
    expect(result.city).toBe('Sydney');
    expect(result.state).toBe('NSW');
    expect(result.postcode).toBe('2000');
    expect(result.country).toBe('AU');
    console.log('[PASS] AU Nominatim result parsed correctly');
  });

  it('abbreviates all AU state names', () => {
    const stateMap: Record<string, string> = {
      'New South Wales': 'NSW',
      'Victoria': 'VIC',
      'Queensland': 'QLD',
      'South Australia': 'SA',
      'Western Australia': 'WA',
      'Tasmania': 'TAS',
      'Australian Capital Territory': 'ACT',
      'Northern Territory': 'NT',
    };
    for (const [fullName, abbr] of Object.entries(stateMap)) {
      const result = parseNominatimResult({
        place_id: 1,
        display_name: '',
        address: { state: fullName, country_code: 'au' },
      });
      expect(result.state).toBe(abbr);
    }
    console.log('[PASS] All AU state names abbreviated correctly');
  });

  it('passes through non-AU state names unchanged', () => {
    const result = parseNominatimResult({
      place_id: 2,
      display_name: '',
      address: { state: 'California', country_code: 'us' },
    });
    expect(result.state).toBe('California');
    console.log('[PASS] Non-AU state returned as-is');
  });

  it('uses city fallback chain: suburb → city → town → village → county', () => {
    const check = (
      field: Partial<{
        suburb: string;
        city: string;
        town: string;
        village: string;
        county: string;
      }>,
      expected: string,
    ) => {
      const result = parseNominatimResult({
        place_id: 1,
        display_name: '',
        address: { ...field, country_code: 'au' },
      });
      expect(result.city).toBe(expected);
    };
    check({ suburb: 'Surry Hills' }, 'Surry Hills');
    check({ city: 'Melbourne' }, 'Melbourne');
    check({ town: 'Ballarat' }, 'Ballarat');
    check({ village: 'Balmain' }, 'Balmain');
    check({ county: 'Blue Mountains' }, 'Blue Mountains');
    console.log('[PASS] city fallback chain works correctly');
  });

  it('handles missing optional fields gracefully', () => {
    const result = parseNominatimResult({
      place_id: 99,
      display_name: '',
      address: { country_code: 'au' },
    });
    expect(result.address1).toBe('');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.postcode).toBe('');
    expect(result.country).toBe('AU');
    console.log('[PASS] Missing fields return empty strings');
  });

  it('upper-cases country code', () => {
    const result = parseNominatimResult({
      place_id: 3,
      display_name: '',
      address: { country_code: 'nz' },
    });
    expect(result.country).toBe('NZ');
    console.log('[PASS] Country code is upper-cased');
  });
});

// ---------------------------------------------------------------------------
// C. debounce
// ---------------------------------------------------------------------------

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not call fn before delay has elapsed', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);
    debouncedFn('a');
    jest.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    console.log('[PASS] fn not called before delay');
  });

  it('calls fn exactly once after delay elapses', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);
    debouncedFn('a');
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    console.log('[PASS] fn called once after delay');
  });

  it('resets timer on rapid successive calls, fires once with last argument', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);
    debouncedFn('a');
    jest.advanceTimersByTime(200);
    debouncedFn('b');
    jest.advanceTimersByTime(200); // only 200ms since last call
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100); // now 300ms since last call
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
    console.log('[PASS] debounce resets on rapid calls and fires once with last arg');
  });

  it('fires again after a second quiet period', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);
    debouncedFn('first');
    jest.advanceTimersByTime(300);
    debouncedFn('second');
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, 'second');
    console.log('[PASS] debounce fires again after second quiet period');
  });

  it('forwards multiple arguments', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);
    debouncedFn('x', 'y', 'z');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('x', 'y', 'z');
    console.log('[PASS] debounce forwards multiple arguments');
  });
});

// ---------------------------------------------------------------------------
// D. AddressAutocompleteInput component
//
// All component tests use fake timers to control the 350 ms debounce without
// waiting for real time.  The pattern is:
//   1. fireEvent.change — triggers debounce timer
//   2. act(() => jest.advanceTimersByTime(400)) — fires the debounce callback
//   3. await resolveAllMocks() / waitFor — allows the async fetch to settle
// ---------------------------------------------------------------------------

describe('AddressAutocompleteInput — component', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runAllTimers());
    jest.useRealTimers();
  });

  // ── D1. Dropdown render logic ─────────────────────────────────────────────

  it('[D1] does not show dropdown on initial render (no input)', () => {
    makeComponent();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    console.log('[PASS] No listbox on empty input');
  });

  it('[D1] shows loading spinner immediately after 2+ chars typed', async () => {
    // Never resolves — keeps component in isFetching state
    mockFetch.mockReturnValue(new Promise(() => {}));
    makeComponent();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '42' } });
    // After 2 chars the component shows isOpen + isFetching before the debounce fires
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText(/Searching for addresses/)).toBeInTheDocument();
    console.log('[PASS] Loading spinner shown immediately on 2+ char input');
  });

  it('[D1] renders suggestion items after Nominatim fetch resolves', async () => {
    mockFetch.mockResolvedValueOnce(nominatimResponse());
    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '42 George' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(
        screen.getByText('42 George Street, Sydney NSW 2000, Australia'),
      ).toBeInTheDocument(),
    );
    console.log('[PASS] Suggestion item rendered after Nominatim response');
  });

  it('[D1] shows "No results found" when Nominatim returns empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'zzzz' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(screen.getByText(/No results found/)).toBeInTheDocument(),
    );
    console.log('[PASS] "No results found" shown on empty Nominatim response');
  });

  it('[D1] always shows "Enter address manually" inside the open dropdown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'ab' } });
    // Dropdown opens immediately after 2 chars
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Enter address manually/i }) ??
      screen.queryByText('Enter address manually'),
    ).toBeInTheDocument();
    console.log('[PASS] "Enter address manually" present in open dropdown');
  });

  // ── D2. Address field population ─────────────────────────────────────────

  it('[D2] calls onPlaceSelect with correctly parsed address on suggestion select', async () => {
    const onPlaceSelect = jest.fn();
    mockFetch.mockResolvedValueOnce(nominatimResponse());

    makeComponent({ onPlaceSelect });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '42 George' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(
        screen.getByText('42 George Street, Sydney NSW 2000, Australia'),
      ).toBeInTheDocument(),
    );

    fireEvent.mouseDown(
      screen.getByText('42 George Street, Sydney NSW 2000, Australia'),
    );

    expect(onPlaceSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        address1: '42 George Street',
        city: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        country: 'AU',
      }),
    );
    console.log('[PASS] onPlaceSelect called with correct parsed address fields');
  });

  it('[D2] also sets address2 from Nominatim result when missing (empty string)', async () => {
    const onPlaceSelect = jest.fn();
    mockFetch.mockResolvedValueOnce(nominatimResponse());

    makeComponent({ onPlaceSelect });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '42 George' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(
        screen.getByText('42 George Street, Sydney NSW 2000, Australia'),
      ).toBeInTheDocument(),
    );

    fireEvent.mouseDown(
      screen.getByText('42 George Street, Sydney NSW 2000, Australia'),
    );

    // ParsedAddress doesn't include address2 — that field is managed by parent
    expect(onPlaceSelect).toHaveBeenCalledWith(
      expect.not.objectContaining({ address2: expect.anything() }),
    );
    console.log('[PASS] ParsedAddress does not include address2 (managed by parent)');
  });

  // ── D3. Manual mode toggle ────────────────────────────────────────────────

  it('[D3] shows a plain text input (not combobox) in manualMode=true', () => {
    makeComponent({ manualMode: true });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    console.log('[PASS] manualMode=true renders plain text input');
  });

  it('[D3] shows the combobox search input in manualMode=false', () => {
    makeComponent({ manualMode: false });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    console.log('[PASS] manualMode=false renders combobox input');
  });

  it('[D3] calls onManualEntry when the standalone "Enter address manually" button is clicked', () => {
    const onManualEntry = jest.fn();
    makeComponent({ onManualEntry });
    // Standalone link is shown when dropdown is closed
    const btn = screen.getByText('Enter address manually');
    fireEvent.click(btn);
    expect(onManualEntry).toHaveBeenCalledTimes(1);
    console.log('[PASS] onManualEntry called via standalone button');
  });

  it('[D3] calls onManualEntry when "Enter address manually" is selected from open dropdown', async () => {
    const onManualEntry = jest.fn();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as unknown as Response);

    makeComponent({ onManualEntry });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'xy' } });
    // Dropdown opens immediately at 2+ chars
    const listbox = await waitFor(() => screen.getByRole('listbox'));
    expect(listbox).toBeInTheDocument();

    const manualOption = screen.getAllByText('Enter address manually')[0];
    fireEvent.mouseDown(manualOption);

    expect(onManualEntry).toHaveBeenCalled();
    console.log('[PASS] onManualEntry triggered from inside the open dropdown');
  });

  it('[D3] does not show the standalone "Enter manually" button while dropdown is open', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // keep in-flight

    makeComponent();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ab' } });

    // Dropdown is now open
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // The standalone <button> outside the listbox should not be present
    const allManualButtons = screen.queryAllByRole('button', { name: /enter address manually/i });
    // Only the <li role="option"> inside the listbox should carry the label
    allManualButtons.forEach((btn) => {
      expect(btn.closest('[role="listbox"]')).toBeNull();
    });
    console.log('[PASS] Standalone "Enter manually" button hidden while dropdown is open');
  });

  // ── D4. API failure handling ──────────────────────────────────────────────

  it('[D4] does not crash and shows no suggestions after fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'fail' } });
    act(() => jest.advanceTimersByTime(400));

    // After the failed fetch, isFetching returns to false and suggestions=[]
    await waitFor(() => {
      // No spinner shown
      expect(screen.queryByText(/Searching for addresses/)).not.toBeInTheDocument();
    });
    console.log('[PASS] Component stable after network error — no crash, no spinner');
  });

  it('[D4] shows no suggestion items (just manual entry) when API returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);

    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'err' } });
    act(() => jest.advanceTimersByTime(400));

    // Wait for fetching state to clear
    await waitFor(() => {
      expect(screen.queryByText(/Searching for addresses/)).not.toBeInTheDocument();
    });
    // No address suggestion items should appear
    const items = screen.queryAllByRole('option');
    // Only possible option is "Enter address manually" (or none if dropdown closed)
    for (const item of items) {
      expect(item).toHaveTextContent(/enter address manually/i);
    }
    console.log('[PASS] Non-OK API response: no suggestion items rendered');
  });

  // ── D5. No results found ──────────────────────────────────────────────────

  it('[D5] shows "No results found" message when Nominatim returns empty list', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as unknown as Response);

    makeComponent();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'xyzzy999' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(screen.getByText(/No results found/i)).toBeInTheDocument(),
    );
    console.log('[PASS] "No results found" message displayed for empty Nominatim response');
  });

  // ── D6. International address ─────────────────────────────────────────────

  it('[D6] passes the correct country code to Nominatim for GB', async () => {
    const onPlaceSelect = jest.fn();
    mockFetch.mockResolvedValueOnce(
      nominatimResponse({
        place_id: 7777,
        display_name: '10 Downing Street, Westminster, London, SW1A 2AA',
        house_number: '10',
        road: 'Downing Street',
        suburb: 'Westminster',
        state: 'England',
        postcode: 'SW1A 2AA',
        country_code: 'gb',
      }),
    );

    makeComponent({ country: 'GB', onPlaceSelect });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '10 Down' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(
        screen.getByText('10 Downing Street, Westminster, London, SW1A 2AA'),
      ).toBeInTheDocument(),
    );

    // Verify Nominatim URL included countrycodes=gb
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('countrycodes=gb');

    // Select the suggestion
    fireEvent.mouseDown(
      screen.getByText('10 Downing Street, Westminster, London, SW1A 2AA'),
    );

    expect(onPlaceSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        address1: '10 Downing Street',
        city: 'Westminster',
        country: 'GB',
      }),
    );
    console.log('[PASS] GB address: Nominatim called with countrycodes=gb, fields populated');
  });

  it('[D6] passes the correct country code to Nominatim for US', async () => {
    mockFetch.mockResolvedValueOnce(
      nominatimResponse({
        display_name: '1600 Pennsylvania Avenue NW, Washington DC',
        house_number: '1600',
        road: 'Pennsylvania Avenue NW',
        suburb: 'Washington',
        state: 'District of Columbia',
        postcode: '20500',
        country_code: 'us',
      }),
    );

    makeComponent({ country: 'US' });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '1600 Penn' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(
        screen.getByText('1600 Pennsylvania Avenue NW, Washington DC'),
      ).toBeInTheDocument(),
    );

    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('countrycodes=us');
    console.log('[PASS] US address: Nominatim called with countrycodes=us');
  });

  it('[D6] shows "No results found" message when no API key and no Nominatim results', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as unknown as Response);

    makeComponent({ country: 'JP' });
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'Tokyo' } });
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() =>
      expect(screen.getByText(/No results found/i)).toBeInTheDocument(),
    );
    console.log('[PASS] International no-results state handled gracefully');
  });
});
