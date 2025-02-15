import SearchEngine from './SearchEngine';
import Note from '../../models/Note';
import Setting from '../../models/Setting';

export default class SearchEngineUtils {
	static async notesForQuery(query: string, applyUserSettings: boolean, options: any = null, searchEngine: SearchEngine = null) {
		if (!options) options = {};

		if (!searchEngine) {
			searchEngine = SearchEngine.instance();
		}

		let searchType = SearchEngine.SEARCH_TYPE_FTS;
		if (query.length && query[0] === '/') {
			query = query.substr(1);
			searchType = SearchEngine.SEARCH_TYPE_BASIC;
		}

		const results = await searchEngine.search(query, { searchType });

		const noteIds = results.map((n: any) => n.id);

		// We need at least the note ID to be able to sort them below so if not
		// present in field list, add it.L Also remember it was auto-added so that
		// it can be removed afterwards.
		let idWasAutoAdded = false;
		const fields = options.fields ? options.fields : Note.previewFields().slice();
		if (fields.indexOf('id') < 0) {
			fields.push('id');
			idWasAutoAdded = true;
		}

		// Add fields is_todo and todo_completed for showCompletedTodos filtering.
		// Also remember that the field  was auto-added so that it can be removed afterwards.
		let isTodoAutoAdded = false;
		if (fields.indexOf('is_todo') < 0) {
			fields.push('is_todo');
			isTodoAutoAdded = true;
		}

		let isTodoCompletedAutoAdded = false;
		if (fields.indexOf('todo_completed') < 0) {
			fields.push('todo_completed');
			isTodoCompletedAutoAdded = true;
		}

		const previewOptions = Object.assign({}, {
			order: [],
			fields: fields,
			conditions: [`id IN ("${noteIds.join('","')}")`],
		}, options);

		const notes = await Note.previews(null, previewOptions);

		// Filter completed todos
		let filteredNotes = [...notes];
		if (applyUserSettings && !Setting.value('showCompletedTodos')) {
			filteredNotes = notes.filter(note => note.is_todo === 0 || (note.is_todo === 1 && note.todo_completed === 0));
		}

		// By default, the notes will be returned in reverse order
		// or maybe random order so sort them here in the correct order
		// (search engine returns the results in order of relevance).
		const sortedNotes = [];
		for (let i = 0; i < filteredNotes.length; i++) {
			const idx = noteIds.indexOf(filteredNotes[i].id);
			sortedNotes[idx] = filteredNotes[i];
			if (idWasAutoAdded) delete sortedNotes[idx].id;
			if (isTodoCompletedAutoAdded) delete sortedNotes[idx].is_todo;
			if (isTodoAutoAdded) delete sortedNotes[idx].todo_completed;
		}

		// Note that when the search engine index is somehow corrupted, it might contain
		// references to notes that don't exist. Not clear how it can happen, but anyway
		// handle it here by checking if `user_updated_time` IS NOT NULL. Was causing this
		// issue: https://discourse.joplinapp.org/t/how-to-recover-corrupted-database/9367
		if (noteIds.length !== notes.length) {
			// remove null objects
			return sortedNotes.filter(n => n);
		} else {
			return sortedNotes;
		}

	}
}
