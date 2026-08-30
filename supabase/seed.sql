-- Masquerade V7 beta seed. Editorially review before public launch.
with inserted as (
 insert into puzzles_private(clue_type,clue_text,answer,difficulty_score,difficulty_band,hint_1,hint_2,hint_3,explanation,is_final_mask,status,numeric_answer)
 values
 ('word','BROKEN','promise',42,'clever','Think beyond physical damage.','The answer can be made or kept.','It depends on trust, not material.','A promise can be broken without touch.',false,'approved',false),
 ('rebus',E'STAND\nI','understand',48,'clever','The layout matters.','Describe where I sits relative to STAND.','Fuse that position with STAND.','I is under STAND.',false,'approved',false),
 ('pattern','3  6  11  18  27  ?','38',54,'clever','Inspect the gaps.','The increases themselves form a sequence.','Continue the odd-number increments.','Differences are 3,5,7,9,11.',false,'approved',true),
 ('logic',E'ALL BLOOPS ARE RAZZIES.\nNO RAZZIES ARE LUMPS.\nCan a BLOOP be a LUMP?','no',59,'clever','Treat the words as sets.','Bloops sit inside Razzies.','Razzies never overlap Lumps.','Therefore no Bloop can be a Lump.',false,'approved',false),
 ('rebus',E'HEAD\nHEELS','over',66,'clever','The relationship matters.','Think of a familiar phrase.','A short word describes HEAD relative to HEELS.','Head over heels.',true,'approved',false),

 ('word','STRESSED','desserts',58,'devious','Meaning is a mask.','No letters change.','Direction alone transforms it.','STRESSED reversed is DESSERTS.',false,'approved',false),
 ('pattern','2  5  10  17  26  ?','37',64,'devious','Look beneath the visible terms.','The differences grow regularly.','Continue the odd-number additions.','+3,+5,+7,+9,+11.',false,'approved',true),
 ('logic',E'A says B lies.\nB says C lies.\nC says A and B both lie.\nExactly one tells truth.\nWho?','b',70,'devious','Test each speaker as the sole truth-teller.','Follow each assumption to contradiction.','Only one candidate leaves both other statements false.','B is the consistent sole truth-teller.',false,'approved',false),
 ('rebus','CYCLE CYCLE CYCLE','tricycle',74,'devious','Count before interpreting.','The noun appears exactly three times.','Use a prefix encoding that count.','Three cycles → tricycle.',false,'approved',false),
 ('word',E'EVIL\n↔','live',80,'devious','The symbol is an instruction.','Keep every letter.','Apply the indicated direction to the word.','EVIL reversed is LIVE.',true,'approved',false),

 ('word','SILENT','listen',72,'fiendish','Definition is a decoy.','Every letter matters exactly once.','Rearrange the letters into a related action.','SILENT is an anagram of LISTEN.',false,'approved',false),
 ('logic',E'SOME ZORS ARE MIPS.\nALL MIPS ARE TAVS.\nMust SOME ZORS be TAVS?','yes',78,'fiendish','Track only the guaranteed members.','Those Zors are definitely Mips.','Every Mip inherits membership in Tavs.','Yes: at least some Zors are Tavs.',false,'approved',false),
 ('pattern','8  5  4  9  1  7  6  3  2  ?','0',84,'fiendish','Arithmetic is a trap.','The English names matter.','The order is determined by spelling.','The sequence is alphabetical by number name; zero is last.',false,'approved',true),
 ('math',E'1 → 1\n2 → 11\n3 → 21\n4 → 1211\n5 → ?','111221',89,'fiendish','The right side reports on what preceded it.','Describe runs of digits.','Count consecutive groups and state count then digit.','Look-and-say progression.',false,'approved',true),
 ('logic',E'What occurs once in a minute,\ntwice in a moment,\nbut never in a thousand years?','m',94,'fiendish','Time is the costume.','Inspect the written nouns.','Count a character across the key words.','The letter M.',true,'approved',false)
 returning id,difficulty_band,difficulty_score
),
games as (
 insert into daily_games(game_date,difficulty_band,published)
 values(current_date,'clever',true),(current_date,'devious',true),(current_date,'fiendish',true)
 on conflict(game_date,difficulty_band) do update set published=true
 returning id,difficulty_band
)
insert into daily_game_puzzles(daily_game_id,puzzle_id,position)
select g.id,p.id,row_number() over(partition by g.id order by p.difficulty_score)::int
from games g join inserted p on p.difficulty_band=g.difficulty_band
on conflict(daily_game_id,position) do nothing;
