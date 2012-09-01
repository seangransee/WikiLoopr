require 'sinatra'
require 'coffee-script'
require 'sass'

get '/' do
  @query = nil
  chosen_line = nil
  File.foreach("startlist.txt").each_with_index do |line, number|
    chosen_line = line if rand < 1.0/(number+1)
  end
  @start = chosen_line
  haml :index
end

get '/wikiloopr.js' do
  coffee :wikiloopr
end

get '/styles.css' do
  sass :styles
end

get '/:query' do
  @query = params[:query]
  @start = ""
  haml :index
end