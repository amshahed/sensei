import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  slugify,
  buildGrammarItem,
  parseGrammarSource,
  GrammarEntry,
} from './grammar';

describe('slugify', () => {
  it('converts tilde to hyphen and strips leading/trailing hyphens', () => {
    // 〜 becomes -, then leading/trailing hyphens are stripped
    expect(slugify('〜は〜です')).toBe('は-です');
  });

  it('lowercases ASCII portions', () => {
    expect(slugify('て-Form')).toBe('て-form');
  });

  it('collapses multiple hyphens and strips leading/trailing', () => {
    // 〜〜Verb → --Verb → collapse → -Verb → strip → Verb
    expect(slugify('〜〜Verb')).toBe('verb');
  });

  it('strips trailing and leading hyphens', () => {
    const result = slugify('〜は');
    expect(result).not.toMatch(/^-|-$/);
    expect(result).toBe('は');
  });
});

describe('buildGrammarItem', () => {
  it('produces correct Item shape for a full entry', () => {
    const entry: GrammarEntry = {
      pattern: '〜は〜です',
      description: 'Topic + copula',
      jlpt: 'N5',
      prereqs: ['ja:grammar:は'],
    };
    const item = buildGrammarItem(entry);
    expect(item).toMatchObject({
      language: 'ja',
      type: 'GRAMMAR',
      display: '〜は〜です',
      reading: null,
      meaning: 'Topic + copula',
    });
    expect(item.id).toMatch(/^ja:grammar:/);
    const data = item.data;
    expect(data.pattern_name).toBe('〜は〜です');
    expect(data.jlpt_level).toBe('N5');
    expect(data.prereqs).toEqual(['ja:grammar:は']);
  });

  it('defaults jlpt to N5 when omitted', () => {
    const item = buildGrammarItem({ pattern: 'は' });
    expect((item.data as { jlpt_level: string }).jlpt_level).toBe('N5');
  });

  it('defaults meaning to null when description omitted', () => {
    const item = buildGrammarItem({ pattern: 'は' });
    expect(item.meaning).toBeNull();
  });
});

describe('parseGrammarSource', () => {
  const tmpDir = os.tmpdir();

  it('parses a JSON array file', () => {
    const entries: GrammarEntry[] = [
      { pattern: 'は', description: 'topic', jlpt: 'N5' },
      { pattern: 'が', description: 'subject' },
    ];
    const filePath = path.join(tmpDir, 'grammar-test.json');
    fs.writeFileSync(filePath, JSON.stringify(entries));

    const result = parseGrammarSource(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].pattern).toBe('は');
    expect(result[1].description).toBe('subject');
  });

  it('parses a TSV file', () => {
    const tsv = 'は\ttopic particle\tN5\n が\tsubject particle\tN5\n';
    const filePath = path.join(tmpDir, 'grammar-test.tsv');
    fs.writeFileSync(filePath, tsv);

    const result = parseGrammarSource(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].pattern).toBe('は');
    expect(result[0].description).toBe('topic particle');
    expect(result[1].pattern).toBe('が');
  });

  it('skips TSV header row when first cell is "pattern"', () => {
    const tsv = 'pattern\tdescription\tJLPT\nは\ttopic\tN5\n';
    const filePath = path.join(tmpDir, 'grammar-header.tsv');
    fs.writeFileSync(filePath, tsv);

    const result = parseGrammarSource(filePath);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe('は');
  });

  it('parses TSV prereqs from comma-separated 4th column', () => {
    const tsv = 'て-form\t\tN5\tja:grammar:verb-stem,ja:grammar:masu\n';
    const filePath = path.join(tmpDir, 'grammar-prereqs.tsv');
    fs.writeFileSync(filePath, tsv);

    const result = parseGrammarSource(filePath);
    expect(result[0].prereqs).toEqual([
      'ja:grammar:verb-stem',
      'ja:grammar:masu',
    ]);
  });
});
